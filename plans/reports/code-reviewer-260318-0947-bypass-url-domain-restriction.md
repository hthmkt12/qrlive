# Code Review: Bypass URL Domain Restriction

**Date**: 2026-03-18
**Reviewer**: Antigravity Code Review Agent
**Scope**: Focused review of BYPASS_URL_ALLOWLIST implementation

---

## Verdict: ✅ No bugs, regressions, or spec mismatches found.

---

## Files Reviewed

| File | Lines | Status |
|------|-------|--------|
| `supabase/functions/redirect/redirect-handler.ts` | 174 | ✅ Clean |
| `supabase/functions/redirect/index.ts` | 97 | ✅ Clean |
| `src/test/redirect-handler.test.ts` | 359 | ✅ Clean |
| `plans/260318-0942-bypass-url-domain-restriction/plan.md` | 20 | ✅ Accurate |

---

## Spec Compliance Checklist

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Comma-separated hostname allowlist | ✅ | `index.ts:74` — `.split(",").map(s => s.trim().toLowerCase()).filter(Boolean)` |
| Unset/empty → allow all | ✅ | `isHostnameAllowed:65` returns `true` when `!allowlist \|\| length === 0`; `parseBypassUrlAllowlist` returns `undefined` for empty/whitespace env var |
| Set → fall through to target_url if not matched | ✅ | `resolveTarget:78` — `isHostnameAllowed` returns false → falls to `route.target_url` |
| No user-visible error for blocked bypass URLs | ✅ | Silent fallthrough only; no error response emitted |
| Backward-compatible (no options = allow all) | ✅ | `bypassAllowlist` param is optional; existing test at line 131 still passes |

---

## Correctness Analysis

### `isHostnameAllowed()` (redirect-handler.ts:64-72)
- Correctly short-circuits to `true` for undefined/empty allowlist.
- Lowercases parsed hostname via `new URL(url).hostname.toLowerCase()` — correct since `new URL` always lowercases hostnames per WHATWG URL spec anyway, but the explicit call is a good belt-and-suspenders safeguard.
- Catches `URL` parse errors silently → returns `false` when allowlist is active. Correct per spec (safe fallback).

### `resolveTarget()` (redirect-handler.ts:74-80)
- Added `bypassAllowlist?: string[]` as a trailing optional param — no breaking change to existing callers.
- Old logic: `route ? route.bypass_url || route.target_url : defaultUrl`. New logic splits this into explicit if-checks. Semantically identical: falsy `bypass_url` (empty string or undefined) short-circuits via `route.bypass_url &&` to fall through to `target_url`. ✅ No regression.
- When `isHostnameAllowed` returns false, correctly falls to `route.target_url` — not `defaultUrl`. This is correct: the geo route match exists, only the bypass gate failed.

### `parseBypassUrlAllowlist()` (index.ts:72-76)
- Normalizes entries: trim, lowercase, filter empty. Returns `undefined` when no valid entries. Correct.
- Called per-request inside `Deno.serve`. Trivial cost for `Deno.env.get` + string split. Acceptable.

### `handleRedirect()` (redirect-handler.ts:155)
- Passes `options.bypassUrlAllowlist` through cleanly. ✅

---

## Test Coverage Assessment

| Test Case | Coverage |
|-----------|----------|
| Allow all when undefined | ✅ Line 309 |
| Allow all when empty `[]` | ✅ Line 318 |
| Use bypass when hostname matches | ✅ Line 328 |
| Fall back when hostname not matched | ✅ Line 338 |
| Case-insensitive matching | ✅ Line 348 |
| Whitespace-only env var → allow all | ✅ Implicit via `parseBypassUrlAllowlist` returning `undefined` (not directly unit-tested since it's Deno-only, but logically covered) |

---

## Residual Risks (Low)

1. **No unit test for unparseable bypass_url with active allowlist.** The `catch` block in `isHostnameAllowed` is trivial (3 lines), but a defensive test like `isHostnameAllowed("not-a-url", ["example.com"])` returning `false` would harden the suite. Severity: very low.

2. **`parseBypassUrlAllowlist` is not unit-tested** because it lives in the Deno-only `index.ts`. This is a conscious architectural tradeoff (avoid Deno globals in testable files). The function is 4 lines with no branching beyond a length check. Severity: very low.

3. **Per-request env var read** (`Deno.env.get` at every request). Not a bug — env reads are sub-microsecond — but if allowlist changes trigger config reloads in the future, caching would be needed. Not a concern today. Severity: negligible.

---

## Findings

None. No bugs, regressions, missing edge cases, or spec mismatches identified.

---

## Unresolved Questions

None.
