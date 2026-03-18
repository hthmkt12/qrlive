# Supabase Proxy Fallback — Revision 1 Report

**Date**: 2026-03-18

---

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/proxy/proxy-handler.ts` | Fixed `timingSafeEqual` + added CORS method |
| `src/test/proxy-edge-function.test.ts` | Added 4 tests (preflight + timing-safe) |

---

## Fixes Made

### 1. `timingSafeEqual()` — no early return on length mismatch
- **Before**: `if (a.length !== b.length) return false;` — leaked length info via timing.
- **After**: Seeds `diff` with `bufA.length ^ bufB.length` (nonzero if lengths differ), then iterates `Math.max(len)` using `?? 0` for out-of-bounds bytes. Returns equality only after full loop.

### 2. CORS preflight — added `Access-Control-Allow-Methods`
- `corsHeaders()` now includes `"Access-Control-Allow-Methods": "GET, OPTIONS"`.
- Browsers sending `Authorization` header trigger CORS preflight; without `Allow-Methods` the preflight would fail.

---

## Tests Added

| # | Test |
|---|------|
| 1 | OPTIONS preflight → 200 with `Access-Control-Allow-Methods` |
| 2 | `timingSafeEqual("secret","secret")` → true |
| 3 | `timingSafeEqual("aaaaaa","bbbbbb")` → false (same length) |
| 4 | `timingSafeEqual("short","muchlongerstring")` → false (different length) |

Total proxy tests: 14. Total suite: 366.

---

## Validation Results

| Command | Result |
|---------|--------|
| `npm run typecheck` | ✅ 0 errors |
| `npm run test` | ✅ 366/366 pass |

---

## LOC Check

`proxy-handler.ts`: 201 → 201 lines (unchanged; the two fixes balanced out). Under-200 nice-to-have not met — would require removing comments or collapsing helpers.

---

## Unresolved Questions

None.
