# Red-Team Review: custom-redirect-domain
**Plan:** plans/260316-0119-custom-redirect-domain/ | **Date:** 2026-03-16

## Verdict: APPROVE WITH CONDITIONS

---

## Critical (BLOCKING)

**1. Plan status stale — already implemented**
All 3 phases done in codebase. Plan still says "Ready to implement". Risk: duplicate work.

**2. VITE_REDIRECT_BASE_URL value inconsistency**
- phase-02: `https://r.yourdomain.com/r` (WITH `/r`)
- deployment-guide.md + worker comment: `https://r.yourdomain.com` (NO `/r`)
Both work functionally, but mixed docs cause misconfiguration. Canonical = no `/r` suffix.

---

## High Risk

**3. Zero test for VITE_REDIRECT_BASE_URL custom domain branch**
`db-utils.test.ts` only tests fallback Supabase URL. Custom domain path untested.

**4. Open header forwarding in Worker**
`headers: request.headers` forwards ALL headers (auth tokens, cookies) to Supabase. Whitelist only: `cf-ipcountry`, `User-Agent`.

**5. Missing null guard for `env.SUPABASE_REDIRECT_URL`**
If env var unset → `targetUrl = undefined/CODE` → 500 with no useful error.

**6. Cloudflare Workers unreliable in China (~30-70% block rate)**
Option A is primary path but Plan acknowledges unreliability without prominent warning. Options B/C (Alibaba, HK VPS) have no code.

**7. No wrangler.toml in repo**
Deployment not reproducible. Route config not version-controlled.

---

## Medium/Low

- Trailing slash in `VITE_REDIRECT_BASE_URL` → double-slash URL (fix: `.replace(/\/$/, '')`)
- Phase-02 code example stale (shows old hardcoded const, old fetch signature)
- No rollback docs: printed QR codes with custom domain = permanently broken if domain goes down
- Worker CORS too permissive (`*`) combined with open header forwarding
- No monitoring/alerting for Worker failures

---

## Missed Edge Cases

- `shortCode` with URL-encoded chars → auto-decoded by `new URL()`, Supabase must handle
- Empty `VITE_REDIRECT_BASE_URL` → falsy → fallback (correct). Whitespace `" "` → truthy → used as domain (bug)
- `http://` base URL → mixed-content warnings in QR scanners

---

## Conditions to Approve

1. Add test for `VITE_REDIRECT_BASE_URL` branch in `db-utils.test.ts`
2. Fix phase-02 VITE_REDIRECT_BASE_URL value (remove `/r` suffix)
3. Add null guard in Worker for missing `env.SUPABASE_REDIRECT_URL`
4. Add `wrangler.toml` to repo
5. Update plan phase statuses to "Done"
