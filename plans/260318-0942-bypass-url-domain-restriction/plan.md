# Bypass URL Domain Restriction

## Overview
Gate bypass_url usage by hostname allowlist (env var `BYPASS_URL_ALLOWLIST`).

## Status: Complete

## Changes

| File | Change |
|------|--------|
| `supabase/functions/redirect/redirect-handler.ts` | Added `isHostnameAllowed()`, `bypassUrlAllowlist` in `RedirectRuntimeOptions` and `resolveTarget()` |
| `supabase/functions/redirect/index.ts` | Read + parse `BYPASS_URL_ALLOWLIST` env var |
| `src/test/redirect-handler.test.ts` | 5 new allowlist test cases |

## Behavior
- Unset/empty env var → allow all bypass URLs (backward-compatible)
- Set env var → only allow bypass_url when hostname matches; otherwise silently fall through to target_url
- Unparseable bypass_url → silently fall through to target_url when allowlist is active
