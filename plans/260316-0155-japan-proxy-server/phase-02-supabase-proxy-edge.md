---
phase: 2
title: "Supabase Edge Function Proxy (Optional)"
status: pending
priority: P3
effort: 2h
---

# Phase 2: Supabase Edge Function Proxy

## Context Links

- [Redirect edge function](../../supabase/functions/redirect/index.ts)
- [plan.md](./plan.md)

## Overview

Zero-infrastructure alternative: a new Supabase Edge Function that fetches a target URL and returns the content directly. No VPS needed — Supabase infrastructure handles everything.

**IMPORTANT CAVEAT:** Supabase domains (`supabase.co`) may themselves be blocked or throttled in China. This approach is a fallback, not the primary recommendation.

## Requirements

### Functional
- New edge function at `/functions/v1/proxy`
- Query params: `url` (target URL), `key` (secret)
- Fetches target URL server-side, streams response back
- Allowlist of permitted hosts via env var
- Passes through Content-Type, Content-Length headers

### Non-Functional
- Max response size: 6MB (Supabase edge function limit)
- Timeout: 25s (Deno Deploy limit)
- Security: secret key + host allowlist

## Architecture

```
CN user -> bypass_url points to:
  https://PROJECT.supabase.co/functions/v1/proxy?url=https://www.company.com/page&key=SECRET
    -> Edge function fetches www.company.com/page
      -> Returns content to user
```

## Edge Function Template

```typescript
// supabase/functions/proxy/index.ts

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const targetUrl = url.searchParams.get("url");
    const key = url.searchParams.get("key");

    // Validate secret key
    const proxySecret = Deno.env.get("PROXY_SECRET");
    if (!key || key !== proxySecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate target URL
    if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
      return new Response(JSON.stringify({ error: "Invalid URL" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Allowlist check
    const allowedHosts = (Deno.env.get("PROXY_ALLOWED_HOSTS") || "")
      .split(",")
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean);

    const targetHost = new URL(targetUrl).hostname.toLowerCase();
    if (!allowedHosts.includes(targetHost)) {
      return new Response(JSON.stringify({ error: "Host not allowed" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch target
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "QRLive-Proxy/1.0",
        Accept: req.headers.get("Accept") || "*/*",
      },
      redirect: "follow",
    });

    // Stream response back
    const headers = new Headers(corsHeaders);
    const contentType = response.headers.get("Content-Type");
    if (contentType) headers.set("Content-Type", contentType);
    const contentLength = response.headers.get("Content-Length");
    if (contentLength) headers.set("Content-Length", contentLength);

    // No caching — content may change
    headers.set("Cache-Control", "no-store");

    return new Response(response.body, {
      status: response.status,
      headers,
    });
  } catch (error) {
    console.error("Proxy error:", error);
    return new Response(JSON.stringify({ error: "Proxy fetch failed" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

## Environment Variables

```bash
# Set via Supabase dashboard or CLI
supabase secrets set PROXY_SECRET=your-random-secret-key-here
supabase secrets set PROXY_ALLOWED_HOSTS=www.company.com,site2.company.com
```

## Deployment

```bash
supabase functions deploy proxy --no-verify-jwt
```

## Implementation Steps

1. Create `supabase/functions/proxy/index.ts` with above template
2. Set `PROXY_SECRET` and `PROXY_ALLOWED_HOSTS` env vars
3. Deploy: `supabase functions deploy proxy --no-verify-jwt`
4. Test: `curl "https://PROJECT.supabase.co/functions/v1/proxy?url=https://www.company.com&key=SECRET"`
5. Set bypass_url in QRLive to the full proxy URL

## Limitations (Be Honest)

| Limitation | Impact |
|-----------|--------|
| Supabase may be blocked in China | Defeats the purpose — Phase 1 is more reliable |
| 6MB response size limit | Large pages or file downloads may fail |
| 25s timeout | Slow origin servers may timeout |
| No cookie forwarding | Auth-dependent pages won't work |
| HTML link rewriting not included | Relative URLs in HTML will break |
| Single request model | No WebSocket, no streaming video |
| Cost at scale | Edge function invocations cost money beyond free tier |

## When to Use This Instead of Phase 1

- Quick testing before committing to a VPS
- Target content is small, static HTML or JSON
- Supabase domain is confirmed accessible from target region
- Don't want to manage any infrastructure

## Security Considerations

- Secret key prevents unauthorized use
- Host allowlist prevents open proxy abuse
- No URL parameter injection (parsed via `new URL()`)
- Rate limiting inherited from Supabase edge function limits

## Success Criteria

- [ ] Edge function deployed and responding
- [ ] Unauthorized requests (wrong/missing key) return 401
- [ ] Non-allowlisted hosts return 403
- [ ] Allowlisted target content proxied correctly
- [ ] Content-Type header preserved
- [ ] Works from test client (may not work from China if Supabase blocked)
