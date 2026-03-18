# Supabase Proxy Edge Function — Report

**Date**: 2026-03-18

---

## Files Changed

| File | Action | Lines |
|------|--------|-------|
| `supabase/functions/proxy/proxy-handler.ts` | NEW | 201 |
| `supabase/functions/proxy/index.ts` | REWRITE | 40 |
| `src/test/proxy-edge-function.test.ts` | NEW | 152 |

---

## Implementation Summary

### `proxy-handler.ts` — Testable handler module
- **Dual auth**: `Authorization: Bearer <SUPABASE_ANON_KEY>` + `key` query param vs `PROXY_SECRET`
- **Constant-time comparison** via `timingSafeEqual()` for both secrets
- **Host allowlist**: `PROXY_ALLOWED_HOSTS` comma-separated; returns 500 JSON if empty/missing
- **SSRF protection**: regex blocks private/loopback IPs
- **Redirect handling**: `redirect: "manual"`, validates Location host against allowlist, 502 for missing Location, 403 for non-allowlisted redirect target
- **25s timeout**: `AbortController` + configurable `timeoutMs` for testability; returns 504 JSON on timeout
- **6 MB size limit**: checks `Content-Length` header → 413 JSON; buffers up to 6 MB if `Content-Length` absent
- **Passthrough**: `Content-Type` and `Content-Length` headers on successful responses
- **CORS**: restricted to `PROXY_ALLOWED_ORIGIN` (default: `https://qrlive.vercel.app`)
- **All error responses**: JSON format

### `index.ts` — Thin Deno wrapper
- Reads env vars (`PROXY_SECRET`, `SUPABASE_ANON_KEY`, `PROXY_ALLOWED_HOSTS`, `PROXY_ALLOWED_ORIGIN`)
- Converts Deno `Request` to `ProxyRequest`, calls `handleProxy()`, converts back to `Response`

### `proxy-edge-function.test.ts` — 10 smoke tests
1. Missing Authorization header → 401
2. Invalid Authorization header → 401
3. Wrong `key` query param → 401
4. Non-allowlisted host → 403
5. Successful fetch preserves Content-Type + Content-Length
6. Upstream fetched with `redirect: "manual"`
7. Allowlisted redirect target passes through 3xx + Location
8. Non-allowlisted redirect target → 403
9. Oversize response by Content-Length → 413
10. Timeout → 504

---

## Validation Results

| Command | Result |
|---------|--------|
| `npm run typecheck` | ✅ 0 errors |
| `npm run test` | ✅ 362/362 pass |

---

## Unresolved Questions

None.
