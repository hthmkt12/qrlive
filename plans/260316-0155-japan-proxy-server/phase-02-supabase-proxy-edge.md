---
phase: 2
title: "Supabase Edge Function Proxy (Optional)"
status: done
priority: P3
effort: 2h
---

# Phase 2: Supabase Edge Function Proxy

## Context Links

- [Proxy handler](../../supabase/functions/proxy/proxy-handler.ts)
- [Deno entry point](../../supabase/functions/proxy/index.ts)
- [Tests](../../src/test/proxy-edge-function.test.ts)
- [plan.md](./plan.md)

## Overview

Zero-infrastructure alternative: a Supabase Edge Function that fetches a target URL and returns the content directly. No VPS needed — Supabase infrastructure handles everything.

**IMPORTANT CAVEAT:** Supabase domains (`supabase.co`) may themselves be blocked or throttled in China. This approach is a fallback, not the primary recommendation.

> **Limitation:** Plain browser redirects cannot attach a custom `Authorization` header, so this endpoint is best suited to scripted or mediated callers unless another component injects the header.

## Implemented Contract

### Endpoint

`GET /functions/v1/proxy?url=<target>&key=<PROXY_SECRET>`

### Authentication (dual)

1. `Authorization: Bearer <SUPABASE_ANON_KEY>` header (required by callers)
2. `key` query parameter matching `PROXY_SECRET` (constant-time compared)

> Runtime note: on this project the deployed function validates that bearer value with
> `PROXY_ANON_KEY` first, then falls back to `SUPABASE_ANON_KEY` if the runtime exposes it.

### Security

- **Host allowlist**: `PROXY_ALLOWED_HOSTS` — comma-separated; if empty/missing → 500 JSON
- **SSRF protection**: private/loopback IPs blocked via regex
- **CORS**: restricted to `PROXY_ALLOWED_ORIGIN` (default: `https://qrlive.vercel.app`)
- Includes `Access-Control-Allow-Methods: GET, OPTIONS`

### Redirect Handling

- `fetch(..., { redirect: "manual" })`
- If upstream returns 3xx without `Location` → 502 JSON
- If redirect target host is allowlisted → pass through 3xx + Location
- If redirect target host is not allowlisted → 403 JSON

### Limits

- **Max response size**: 6 MB — checked via `Content-Length` (413 JSON), or buffer up to 6 MB if absent
- **Timeout**: 25 s via `AbortController` → 504 JSON

### Response Passthrough

- Best-effort passthrough for `Content-Type` and `Content-Length`
- All error responses are JSON `{ "error": "..." }`
- Successful responses include `Cache-Control: no-store`

### Managed Supabase HTML Limitation

- On managed Supabase, `GET` edge functions that return `text/html` are rewritten to `text/plain` unless served behind a custom domain.
- This means HTML proxy responses may lose exact `Content-Type` / `Content-Length` passthrough even when upstream headers are correct.
- For exact browser-facing HTML passthrough, prefer Phase 1 (`proxy-gateway` on Fly.io) or a custom domain in front of the function.

## Environment Variables

```bash
# Required
supabase secrets set PROXY_SECRET=your-random-secret-key-here
supabase secrets set PROXY_ALLOWED_HOSTS=www.company.com,site2.company.com
# Optional (defaults to https://qrlive.vercel.app)
supabase secrets set PROXY_ALLOWED_ORIGIN=https://qrlive.vercel.app
# Runtime auth fallback (recommended on this project)
supabase secrets set PROXY_ANON_KEY=<same value as VITE_SUPABASE_PUBLISHABLE_KEY>
# The function prefers PROXY_ANON_KEY and falls back to SUPABASE_ANON_KEY if available.
```

## Deployment

```bash
supabase functions deploy proxy --no-verify-jwt
# Or via npx if global CLI unavailable:
npx -y supabase functions deploy proxy --no-verify-jwt
```

## Architecture

```
Proxy handler: supabase/functions/proxy/proxy-handler.ts  (testable, ~200 LOC)
Deno wrapper:  supabase/functions/proxy/index.ts          (env vars, ~40 LOC)
Tests:         src/test/proxy-edge-function.test.ts       (14 smoke tests)
```

## Response Codes

| Code | Meaning |
|------|---------|
| 200  | Upstream content returned |
| 3xx  | Allowlisted upstream redirect passed through |
| 400  | Invalid or missing `url` param |
| 401  | Missing/wrong `Authorization` header or `key` param |
| 403  | Host or redirect target not in allowlist |
| 413  | Response exceeds 6 MB |
| 500  | `PROXY_ALLOWED_HOSTS` not configured |
| 502  | Upstream fetch failed or bad redirect |
| 504  | Upstream timeout (25 s) |

## Limitations

| Limitation | Impact |
|-----------|--------|
| Supabase may be blocked in China | Defeats the purpose — Phase 1 is more reliable |
| 6 MB response size limit | Large pages or file downloads may fail |
| 25 s timeout | Slow origin servers may timeout |
| No cookie forwarding | Auth-dependent pages won't work |
| HTML link rewriting not included | Relative URLs in HTML will break |
| Single request model | No WebSocket, no streaming video |
| Cost at scale | Edge function invocations cost money beyond free tier |
| Browser redirect limitation | Cannot attach Authorization header via plain redirect |
| Runtime env caveat | On this project, `PROXY_ANON_KEY` was required because `SUPABASE_ANON_KEY` was not readable via `Deno.env.get()` after deploy |
| Managed Supabase HTML rewrite | `GET` HTML responses are rewritten to `text/plain` unless served behind a custom domain |

## When to Use This Instead of Phase 1

- Quick testing before committing to a VPS
- Target content is small, static HTML or JSON
- Supabase domain is confirmed accessible from target region
- Don't want to manage any infrastructure

## Success Criteria

- [x] Edge function deployed and responding
- [x] Unauthorized requests (wrong/missing key or header) return 401
- [x] Non-allowlisted hosts return 403
- [x] Allowlisted target content proxied correctly
- [x] Handler preserves upstream `Content-Type` / `Content-Length` in tests
- [x] Managed Supabase HTML rewrite documented as a platform limitation for live GET HTML traffic
- [x] Oversize responses return 413
- [x] Timeout returns 504
- [x] 14 smoke tests pass
