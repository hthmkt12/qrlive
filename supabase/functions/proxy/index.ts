/**
 * Supabase Edge Function: Content Proxy - Deno entry point.
 *
 * STATUS: FALLBACK / TESTING ONLY - DO NOT USE IN PRODUCTION.
 * For production bypass_url traffic, use proxy-gateway/ (Fly.io Tokyo).
 * For production redirect-domain access, use cloudflare-worker/.
 *
 * Required env vars (set via Supabase dashboard or CLI):
 *   PROXY_SECRET          - secret key; clients supply as `key` query param
 *   PROXY_ANON_KEY        - recommended anon-key override for runtime validation
 *   SUPABASE_ANON_KEY     - optional fallback if the runtime exposes it
 *   PROXY_ALLOWED_HOSTS   - comma-separated allowlist
 *   PROXY_ALLOWED_ORIGIN  - CORS origin (default: https://qrlive.vercel.app)
 *
 * Deploy: supabase functions deploy proxy --no-verify-jwt
 */

import { handleProxy, type ProxyRuntimeOptions } from "./proxy-handler.ts";

function parseAllowedHosts(): string[] {
  const raw = Deno.env.get("PROXY_ALLOWED_HOSTS") ?? "";
  return raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

function buildOptions(): ProxyRuntimeOptions {
  return {
    proxySecret: Deno.env.get("PROXY_SECRET") ?? "",
    // Supabase blocks user-defined SUPABASE_* secrets, so allow a non-reserved fallback.
    supabaseAnonKey: Deno.env.get("PROXY_ANON_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    allowedHosts: parseAllowedHosts(),
    allowedOrigin: Deno.env.get("PROXY_ALLOWED_ORIGIN") || "https://qrlive.vercel.app",
  };
}

Deno.serve(async (req) => {
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const proxyReq = { method: req.method, url: req.url, headers };
  const result = await handleProxy(proxyReq, buildOptions());
  const responseHeaders = new Headers(result.headers);
  const contentType = responseHeaders.get("Content-Type") ?? "";
  const isTextual = /^(text\/|application\/(json|javascript|xml)|image\/svg\+xml)/i.test(contentType);

  if (isTextual) responseHeaders.delete("Content-Length");

  const body = result.body
    ? isTextual
      ? new TextDecoder().decode(result.body)
      : new Blob([result.body], contentType ? { type: contentType } : undefined)
    : null;

  return new Response(body, { status: result.status, headers: responseHeaders });
});
