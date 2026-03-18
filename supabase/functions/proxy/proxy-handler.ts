/**
 * Supabase Edge Function Proxy — Testable handler module.
 *
 * STATUS: FALLBACK / TESTING ONLY.
 * Zero-infrastructure alternative to the canonical proxy-gateway/ (Fly.io).
 * supabase.co may itself be blocked by GFW in China.
 */

/* ── Types ─────────────────────────────────────────────────────────── */

export interface ProxyRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
}

export interface ProxyResponse {
  status: number;
  headers: Record<string, string>;
  body: Uint8Array | null;
}

export interface ProxyRuntimeOptions {
  proxySecret: string;
  supabaseAnonKey: string;
  allowedHosts: string[];
  allowedOrigin: string;
  fetchImpl?: typeof fetch;
  /** Upstream fetch timeout in ms. Default: 25 000. */
  timeoutMs?: number;
}

/* ── Constants ─────────────────────────────────────────────────────── */

const MAX_BODY_BYTES = 6 * 1024 * 1024; // 6 MB
const TIMEOUT_MS = 25_000;
const SSRF_PATTERN = /^(localhost|127\.\d+\.\d+\.\d+|::1|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+)$/i;

/* ── Helpers ───────────────────────────────────────────────────────── */

function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

function jsonResponse(status: number, body: Record<string, string>, origin: string): ProxyResponse {
  return {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    body: new TextEncoder().encode(JSON.stringify(body)),
  };
}

/** Constant-time string comparison — never short-circuits on length mismatch. */
export function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  const len = Math.max(bufA.length, bufB.length);
  let diff = bufA.length ^ bufB.length; // nonzero if lengths differ
  for (let i = 0; i < len; i++) diff |= (bufA[i] ?? 0) ^ (bufB[i] ?? 0);
  return diff === 0;
}

function isHostAllowed(hostname: string, allowedHosts: string[]): boolean {
  return allowedHosts.includes(hostname.toLowerCase());
}

/* ── Main handler ──────────────────────────────────────────────────── */

export async function handleProxy(req: ProxyRequest, options: ProxyRuntimeOptions): Promise<ProxyResponse> {
  const origin = options.allowedOrigin;

  // CORS preflight
  if (req.method === "OPTIONS") {
    return { status: 200, headers: corsHeaders(origin), body: null };
  }

  try {
    // ── Auth: Authorization header must be Bearer <SUPABASE_ANON_KEY> ──
    const authHeader = req.headers["authorization"] || "";
    if (!authHeader.startsWith("Bearer ") || !timingSafeEqual(authHeader.slice(7), options.supabaseAnonKey)) {
      return jsonResponse(401, { error: "Unauthorized" }, origin);
    }

    // ── Auth: `key` query param must match PROXY_SECRET ──
    const parsedUrl = new URL(req.url);
    const keyParam = parsedUrl.searchParams.get("key") || "";
    if (!keyParam || !timingSafeEqual(keyParam, options.proxySecret)) {
      return jsonResponse(401, { error: "Unauthorized" }, origin);
    }

    // ── Validate target URL ──
    const targetUrl = parsedUrl.searchParams.get("url");
    if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
      return jsonResponse(400, { error: "Invalid URL" }, origin);
    }

    // ── Allowlist check ──
    if (options.allowedHosts.length === 0) {
      return jsonResponse(500, { error: "PROXY_ALLOWED_HOSTS not configured" }, origin);
    }

    const targetHost = new URL(targetUrl).hostname.toLowerCase();
    if (SSRF_PATTERN.test(targetHost) || !isHostAllowed(targetHost, options.allowedHosts)) {
      return jsonResponse(403, { error: "Host not allowed" }, origin);
    }

    // ── Fetch with timeout ──
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? TIMEOUT_MS);
    const doFetch = options.fetchImpl ?? fetch;

    let upstream: Response;
    try {
      upstream = await doFetch(targetUrl, {
        headers: {
          "User-Agent": "QRLive-Proxy/1.0",
          Accept: req.headers["accept"] || "*/*",
          "Accept-Language": req.headers["accept-language"] || "zh-CN,zh;q=0.9,en;q=0.8",
        },
        redirect: "manual",
        signal: controller.signal,
      });
    } catch (err: unknown) {
      clearTimeout(timer);
      const isAbort = (err instanceof Error || err instanceof DOMException) && err.name === "AbortError";
      if (isAbort) {
        return jsonResponse(504, { error: "Upstream timeout" }, origin);
      }
      throw err;
    }
    clearTimeout(timer);

    // ── Upstream redirect handling ──
    if (upstream.status >= 300 && upstream.status < 400) {
      const location = upstream.headers.get("Location");
      if (!location) {
        return jsonResponse(502, { error: "Bad redirect" }, origin);
      }
      const redirectHost = new URL(location, targetUrl).hostname.toLowerCase();
      if (SSRF_PATTERN.test(redirectHost) || !isHostAllowed(redirectHost, options.allowedHosts)) {
        return jsonResponse(403, { error: "Redirect target not allowed" }, origin);
      }
      return {
        status: upstream.status,
        headers: { ...corsHeaders(origin), Location: location },
        body: null,
      };
    }

    // ── Size check by Content-Length ──
    const upstreamCL = upstream.headers.get("Content-Length");
    const contentType = upstream.headers.get("Content-Type") || "";
    const responseHeaders: Record<string, string> = {
      ...corsHeaders(origin),
      "Cache-Control": "no-store",
    };
    if (contentType) responseHeaders["Content-Type"] = contentType;

    if (upstreamCL) {
      const size = parseInt(upstreamCL, 10);
      if (size > MAX_BODY_BYTES) {
        return jsonResponse(413, { error: "Response too large" }, origin);
      }
      responseHeaders["Content-Length"] = upstreamCL;
      // Stream — Content-Length is within limit
      const body = new Uint8Array(await upstream.arrayBuffer());
      return { status: upstream.status, headers: responseHeaders, body };
    }

    // ── No Content-Length: buffer up to 6 MB ──
    const chunks: Uint8Array[] = [];
    let totalSize = 0;
    const reader = upstream.body?.getReader();
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        totalSize += value.byteLength;
        if (totalSize > MAX_BODY_BYTES) {
          reader.cancel();
          return jsonResponse(413, { error: "Response too large" }, origin);
        }
        chunks.push(value);
      }
    }
    const merged = new Uint8Array(totalSize);
    let offset = 0;
    for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength; }
    responseHeaders["Content-Length"] = String(totalSize);
    return { status: upstream.status, headers: responseHeaders, body: merged };

  } catch (error) {
    console.error("Proxy fetch error:", error);
    return jsonResponse(502, { error: "Proxy fetch failed" }, origin);
  }
}
