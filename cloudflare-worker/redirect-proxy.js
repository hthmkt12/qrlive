/**
 * Cloudflare Worker: QR Redirect Proxy
 *
 * Proxies QR redirect requests through a custom domain to the Supabase Edge Function.
 * Purpose: make QR links accessible from China / regions where supabase.co is blocked.
 *
 * Required secrets (set via wrangler secret put, never commit):
 *   SUPABASE_URL       — e.g. https://<project>.supabase.co
 *   SUPABASE_ANON_KEY  — Supabase anon/public key
 *
 * Supports:
 *   GET  /CODE       → proxy to Supabase redirect function
 *   GET  /r/CODE     → same, alternate path style
 *   POST /CODE       → password-protected link submission (body forwarded)
 *   POST /r/CODE     → same, alternate path style
 */

/**
 * Extract the short code from the request pathname.
 * Supports /CODE and /r/CODE path styles.
 * @param {string} pathname
 * @returns {string|null}
 */
export function extractShortCode(pathname) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  // /r/CODE → segments = ["r", "CODE"]
  if (segments[0] === "r") {
    return segments.length >= 2 ? segments[1] : null;
  }
  // /CODE → segments = ["CODE"]
  if (segments.length === 1) {
    return segments[0];
  }
  return null;
}

/**
 * Build upstream headers preserving geo-routing and content-type info.
 * Injects Supabase auth headers.
 * @param {Headers} incoming
 * @param {string} anonKey
 * @returns {Headers}
 */
export function buildUpstreamHeaders(incoming, anonKey) {
  const headers = new Headers();

  // Preserve geo-routing and client info headers
  const preserve = [
    "cf-ipcountry",
    "cf-connecting-ip",
    "x-real-ip",
    "x-forwarded-for",
    "user-agent",
    "referer",
    "content-type",
    "accept",
  ];
  for (const key of preserve) {
    const val = incoming.get(key);
    if (val) headers.set(key, val);
  }

  // Supabase auth
  headers.set("apikey", anonKey);
  headers.set("Authorization", `Bearer ${anonKey}`);

  return headers;
}

export default {
  async fetch(request, env) {
    const { SUPABASE_URL, SUPABASE_ANON_KEY } = env;

    // Guard: fail fast if secrets missing
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      const missing = [];
      if (!SUPABASE_URL) missing.push("SUPABASE_URL");
      if (!SUPABASE_ANON_KEY) missing.push("SUPABASE_ANON_KEY");
      return new Response(
        JSON.stringify({ error: `Missing required secrets: ${missing.join(", ")}` }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // Only GET and POST allowed
    if (request.method !== "GET" && request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const url = new URL(request.url);
    const shortCode = extractShortCode(url.pathname);

    if (!shortCode) {
      return new Response(JSON.stringify({ error: "Short code required" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Build upstream URL
    const targetUrl = `${SUPABASE_URL}/functions/v1/redirect/${shortCode}`;
    const headers = buildUpstreamHeaders(request.headers, SUPABASE_ANON_KEY);

    // Forward request, including body for POST (password-protected links)
    const fetchOpts = {
      method: request.method,
      headers,
      redirect: "manual",
    };
    if (request.method === "POST") {
      fetchOpts.body = request.body;
    }

    const response = await fetch(targetUrl, fetchOpts);
    return response;
  },
};
