# Docs Sync — Supabase Proxy Fallback Contract

**Date**: 2026-03-18

---

## Files Changed

| File | Change |
|------|--------|
| `docs/openapi.yaml` | Updated proxy path, security schemes, added 413/504 responses |
| `plans/260316-0155-japan-proxy-server/phase-02-supabase-proxy-edge.md` | Full rewrite to match implemented contract |

---

## What Was Synced

### `openapi.yaml`
- Added `key` query parameter to `/functions/v1/proxy` endpoint
- Changed security from single `ProxyBearerAuth` to dual `SupabaseAnonKey` + `ProxySecretKey`
- Added 413 (`ProxyTooLarge`) and 504 (`ProxyTimeout`) response definitions
- Updated description with dual auth, redirect handling, size/timeout limits, CORS origin
- Added browser Authorization header limitation note
- Updated `ProxyFailure` description to distinguish from timeout

### `phase-02-supabase-proxy-edge.md`
- Removed outdated 100-line inline code template (now in `proxy-handler.ts`)
- Replaced with implemented contract: dual auth, SSRF, redirect handling, 6MB/25s limits
- Updated deployment command to `--no-verify-jwt` with `npx` fallback
- Updated architecture section to reference actual file structure
- Added response codes table
- Checked all success criteria
- Added browser redirect limitation to limitations table

---

## Unresolved Questions

None.
