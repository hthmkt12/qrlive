# Bypass URL Domain Restriction — Report

**Date**: 2026-03-18
**Task**: Implement `BYPASS_URL_ALLOWLIST` env-var gating for bypass URLs in the redirect edge function.

---

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/redirect/redirect-handler.ts` | Added `isHostnameAllowed()` helper, `bypassUrlAllowlist` to `RedirectRuntimeOptions`, updated `resolveTarget()` signature and logic |
| `supabase/functions/redirect/index.ts` | Added `parseBypassUrlAllowlist()` to read `BYPASS_URL_ALLOWLIST` env var; passes result to `handleRedirect` options |
| `src/test/redirect-handler.test.ts` | Added 5 new tests in `describe("bypass_url allowlist")` block |

---

## Implementation Summary

### `redirect-handler.ts`
- **`isHostnameAllowed(url, allowlist?)`** — exported function. Returns `true` if allowlist is undefined/empty (backward-compat). When set, parses URL hostname, lowercases, checks against allowlist. Parse failures silently return `false`.
- **`resolveTarget()`** — accepts optional `bypassAllowlist?: string[]` param. A geo route's `bypass_url` is only used when `isHostnameAllowed()` approves it; otherwise falls through to `target_url`.
- **`RedirectRuntimeOptions`** — added `bypassUrlAllowlist?: string[]`.
- **`handleRedirect()`** — passes `options.bypassUrlAllowlist` to `resolveTarget()`.

### `index.ts`
- **`parseBypassUrlAllowlist()`** — reads `Deno.env.get("BYPASS_URL_ALLOWLIST")`, splits by comma, trims, lowercases, filters empty. Returns `undefined` when no valid entries (allow-all default).
- Result passed as `bypassUrlAllowlist` in the `handleRedirect` options.

### `redirect-handler.test.ts`
Five new tests:
1. Allow all when `bypassUrlAllowlist` is undefined
2. Allow all when `bypassUrlAllowlist` is `[]` (empty)
3. Use bypass_url when hostname is in the allowlist
4. Fall back to target_url when hostname is NOT in the allowlist
5. Case-insensitive hostname matching

---

## Validation Results

| Command | Result |
|---------|--------|
| `npm run typecheck` | ✅ Pass (0 errors) |
| `npm run lint` | ✅ Pass (0 errors, existing warnings only) |
| `npm run test` | ✅ 352/352 pass (including 5 new allowlist tests) |

---

## Design Notes

- **Silent fallback**: blocked bypass URLs silently resolve to `target_url` — no user-visible error.
- **Unparseable bypass_url**: when allowlist enforcement is active, malformed URLs fail `new URL()` parse and silently fall through to `target_url`.
- **Backward compatibility**: unset or empty env var allows all bypass URLs, matching existing behavior exactly.
- **No Deno globals in handler**: env var read in `index.ts`, passed via `RedirectRuntimeOptions` — handler remains testable under Node/Vitest.

---

## Unresolved Questions

None.
