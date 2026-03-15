/**
 * Cloudflare Worker: QR Redirect Proxy
 *
 * Proxies QR redirect requests through a custom domain to the Supabase Edge Function.
 * Purpose: make QR links accessible from China / regions where supabase.co is blocked.
 *
 * Deploy:
 *   1. Replace SUPABASE_REDIRECT_URL below with your Supabase project URL
 *   2. wrangler deploy redirect-proxy.js --name qrlive-redirect --route "r.yourdomain.com/*"
 *
 * DNS setup:
 *   Add CNAME record: r.yourdomain.com → workers.dev (Cloudflare proxied)
 *
 * Vercel env var:
 *   VITE_REDIRECT_BASE_URL=https://r.yourdomain.com
 *
 * IMPORTANT: This worker forwards all request headers including cf-ipcountry,
 * which the Supabase function uses for geo-routing. Do NOT strip headers.
 */

const SUPABASE_REDIRECT_URL = "https://YOUR_PROJECT_ID.supabase.co/functions/v1/redirect";

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET",
        },
      });
    }

    // Extract short code from path — supports both /CODE and /r/CODE
    const segments = url.pathname.split("/").filter(Boolean);
    const shortCode = segments[segments.length - 1];

    if (!shortCode) {
      return new Response("Not found", { status: 404 });
    }

    // Forward to Supabase, preserving original headers (cf-ipcountry, user-agent, etc.)
    const targetUrl = `${SUPABASE_REDIRECT_URL}/${shortCode}`;
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: request.headers,
      redirect: "manual", // let Supabase redirect pass through as-is
    });

    return response;
  },
};
