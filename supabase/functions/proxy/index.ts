/**
 * Supabase Edge Function: Content Proxy
 *
 * STATUS: FALLBACK / TESTING ONLY — DO NOT USE IN PRODUCTION.
 *
 * Zero-infrastructure alternative to the canonical proxy-gateway/ service.
 * Fetches a target URL server-side and streams the response back to the client.
 *
 * IMPORTANT: supabase.co may itself be blocked by GFW in China.
 * → For production bypass_url traffic, use proxy-gateway/ (Fly.io Tokyo).
 * → For production redirect-domain access, use cloudflare-worker/.
 * This function exists only for local testing or emergency fallback.
 *
 * Required env vars (set via Supabase dashboard or CLI):
 *   PROXY_SECRET          — secret key; clients must supply in Authorization header
 *   PROXY_ALLOWED_HOSTS   — comma-separated allowlist, e.g. "www.company.com,files.company.com"
 *   PROXY_ALLOWED_ORIGIN  — CORS origin (default: https://qrlive.vercel.app)
 *
 * Usage:
 *   curl -H "Authorization: Bearer SECRET" \
 *     "/functions/v1/proxy?url=https://www.company.com/page"
 *
 * Deploy:
 *   supabase functions deploy proxy
 */

// [F12-FIXED] Restrict CORS to QRLive origin — wildcard allows any site to read proxied responses
const allowedOrigin = Deno.env.get("PROXY_ALLOWED_ORIGIN") || "https://qrlive.vercel.app";
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Block private/loopback IP ranges to prevent SSRF to internal network
const SSRF_PATTERN = /^(localhost|127\.\d+\.\d+\.\d+|::1|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+)$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const targetUrl = url.searchParams.get("url");

    // [F2-FIXED] Secret in Authorization header, NOT query param.
    // Query params appear in logs, browser history, QR codes, and the geo_routes DB column.
    const authHeader = req.headers.get("Authorization");
    const proxySecret = Deno.env.get("PROXY_SECRET");
    if (!proxySecret || !authHeader || authHeader !== `Bearer ${proxySecret}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate target URL format
    if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
      return new Response(JSON.stringify({ error: "Invalid URL" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Allowlist check — prevents proxying arbitrary hosts
    const allowedHosts = (Deno.env.get("PROXY_ALLOWED_HOSTS") || "")
      .split(",")
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean);

    if (allowedHosts.length === 0) {
      return new Response(JSON.stringify({ error: "PROXY_ALLOWED_HOSTS not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetHost = new URL(targetUrl).hostname.toLowerCase();

    if (SSRF_PATTERN.test(targetHost)) {
      return new Response(JSON.stringify({ error: "Host not allowed" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!allowedHosts.includes(targetHost)) {
      return new Response(JSON.stringify({ error: "Host not allowed" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // [F1-FIXED] Do NOT follow redirects — an allowlisted origin could redirect to private IPs (SSRF).
    const upstream = await fetch(targetUrl, {
      headers: {
        "User-Agent": "QRLive-Proxy/1.0",
        Accept: req.headers.get("Accept") || "*/*",
        "Accept-Language": req.headers.get("Accept-Language") || "zh-CN,zh;q=0.9,en;q=0.8",
      },
      redirect: "manual",
    });

    // Re-validate redirect target before forwarding the 3xx to the client
    if (upstream.status >= 300 && upstream.status < 400) {
      const location = upstream.headers.get("Location");
      if (!location) {
        return new Response(JSON.stringify({ error: "Bad redirect" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const redirectHost = new URL(location, targetUrl).hostname.toLowerCase();
      if (SSRF_PATTERN.test(redirectHost) || !allowedHosts.includes(redirectHost)) {
        return new Response(JSON.stringify({ error: "Redirect target not allowed" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Safe redirect — let client navigate to the allowed location
      return new Response(null, {
        status: upstream.status,
        headers: { ...corsHeaders, Location: location },
      });
    }

    // Build response headers — pass through Content-Type and Content-Length
    const headers = new Headers(corsHeaders);
    const contentType = upstream.headers.get("Content-Type");
    if (contentType) headers.set("Content-Type", contentType);
    const contentLength = upstream.headers.get("Content-Length");
    if (contentLength) headers.set("Content-Length", contentLength);
    // No proxy-level caching — each request fetches fresh content
    headers.set("Cache-Control", "no-store");

    // Stream response body directly — avoids buffering large responses in memory
    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    console.error("Proxy fetch error:", error);
    return new Response(JSON.stringify({ error: "Proxy fetch failed" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
