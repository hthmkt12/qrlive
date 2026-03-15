# Code Review: Proxy Security Fixes

**File:** `supabase/functions/proxy/index.ts`
**Date:** 2026-03-16
**Reviewer:** code-reviewer agent
**Score: 9/10**

---

## Scope

- Lines: 141 (under 200 limit)
- Focus: F12 (CORS), F2 (auth header), F1 (redirect + SSRF)

---

## Fix Verification

### F12 — CORS wildcard → `PROXY_ALLOWED_ORIGIN` env var

**Status: PASS**

```ts
const allowedOrigin = Deno.env.get("PROXY_ALLOWED_ORIGIN") || "https://qrlive.vercel.app";
const corsHeaders = { "Access-Control-Allow-Origin": allowedOrigin, ... };
```

- Correctly replaces `*` with env var
- Default fallback is safe (specific origin, not wildcard)
- Applied to all response paths: OPTIONS preflight, 401, 400, 403, 500, 502, and success

**Minor gap:** CORS headers on the 3xx redirect response (`line 117`) do NOT include `corsHeaders` — only `Location` is forwarded. Browser may block the response if the preflight sees no CORS header on the redirect. Low severity since the redirect is passed to the client to navigate rather than an XHR fetch, but worth noting.

---

### F2 — Auth from `?key=` query param → `Authorization: Bearer` header

**Status: PASS**

```ts
const authHeader = req.headers.get("Authorization");
const proxySecret = Deno.env.get("PROXY_SECRET");
if (!proxySecret || !authHeader || authHeader !== `Bearer ${proxySecret}`) { ... }
```

- Constant-time-safe string comparison is NOT used (uses `!==`). In JavaScript/Deno this is not a practical timing-attack risk for secrets of this length over HTTP, but noted.
- Correctly guards the case where `PROXY_SECRET` is unset (fails closed — 401 returned).
- No query param fallback left behind.
- Auth check happens before allowlist/URL parsing — correct order.

---

### F1 — `redirect: "follow"` → `redirect: "manual"` + redirect host re-validation

**Status: PASS**

```ts
redirect: "manual",
```

Redirect handling block (lines 101–118):
- Detects 3xx status range correctly (`>= 300 && < 400`)
- Resolves relative Location headers via `new URL(location, targetUrl)` — correct
- Re-runs SSRF pattern check AND allowlist check on the redirect host — both guards applied
- Returns 403 on blocked redirect rather than silently dropping or following
- Safe redirects are forwarded to client as 3xx (client navigates), not followed server-side

---

## Existing Guards — Regression Check

### SSRF private-IP block

```ts
const SSRF_PATTERN = /^(localhost|127\.\d+\.\d+\.\d+|::1|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+)$/i;
```

- Pattern intact, unchanged
- Applied at line 76 (initial fetch) AND line 110 (redirect target) — no regression
- Covers: localhost, 127.x, ::1, 10.x, 172.16-31.x, 192.168.x, 169.254.x (link-local)

**Gap:** IPv6 private ranges beyond `::1` not covered (e.g., `fc00::/7`, `fd00::/8`). Not a regression — was a pre-existing limitation.

### Allowlist check

- Applied at line 83 (initial fetch) AND line 110 (redirect target)
- Empty allowlist returns 500 (fails closed) — correct
- Hostname extracted via `new URL().hostname` — no bypass via port or path confusion

---

## Error Handling

| Path | Status | Body |
|------|--------|------|
| PROXY_SECRET unset | 401 | `{"error":"Unauthorized"}` |
| Bad auth | 401 | `{"error":"Unauthorized"}` |
| Missing/invalid URL | 400 | `{"error":"Invalid URL"}` |
| PROXY_ALLOWED_HOSTS unset | 500 | `{"error":"PROXY_ALLOWED_HOSTS not configured"}` |
| SSRF/allowlist block | 403 | `{"error":"Host not allowed"}` |
| Redirect SSRF/block | 403 | `{"error":"Redirect target not allowed"}` |
| Missing Location header | 502 | `{"error":"Bad redirect"}` |
| Fetch throws | 502 | `{"error":"Proxy fetch failed"}` |

All paths covered. No unhandled throws outside the try/catch.

---

## Issues

| # | Severity | Description |
|---|----------|-------------|
| 1 | Low | CORS headers missing from 3xx redirect response (line 117) |
| 2 | Low | `!==` string comparison instead of timing-safe compare for auth secret |
| 3 | Low (pre-existing) | IPv6 private ranges (fc00::/7, fd00::/8) not in SSRF_PATTERN |

---

## Positive Observations

- All three fixes are correctly implemented with no obvious regressions
- Auth check order is correct (before URL parsing — avoids info leakage)
- `redirect: "manual"` + re-validation is the correct pattern for SSRF-safe proxies
- Relative Location headers resolved against base URL before validation — avoids bypass
- Code is clean, well-commented, and under 200 lines
- Fails closed on missing env vars

---

## Score: 9/10

Deducted 1 point for the missing CORS headers on the 3xx redirect path. All three target fixes are correctly implemented. No regressions in existing SSRF or allowlist guards.

---

## Unresolved Questions

- Should the 3xx response include `corsHeaders` so browsers don't block cross-origin redirects?
- Is timing-safe comparison required per the project's threat model, or is `!==` acceptable?
