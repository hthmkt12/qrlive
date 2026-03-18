# Code Review — Supabase Proxy Fallback

**Date**: 2026-03-18  
**Reviewer**: code-reviewer  
**Scope**: `proxy-handler.ts`, `index.ts`, `proxy-edge-function.test.ts`

---

## Verdict

**No bugs, regressions, or spec mismatches found.** All spec contract items verified below.

---

## Spec Compliance Matrix

| # | Requirement | Status | Location |
|---|-------------|--------|----------|
| 1 | Query params `url`, `key` | ✅ | handler L90-93, L97 |
| 2 | `key` constant-time compared to `PROXY_SECRET` | ✅ | handler L92, `timingSafeEqual` L58-65 |
| 3 | `Authorization: Bearer <SUPABASE_ANON_KEY>` | ✅ | handler L83-86 |
| 4 | `PROXY_ALLOWED_HOSTS` allowlist; empty→config error | ✅ | handler L102-104 (500 JSON) |
| 5 | `redirect: "manual"` | ✅ | handler L125 |
| 6 | Non-allowlisted host → 403 | ✅ | handler L108-109 |
| 7 | Redirect without Location → 502 | ✅ | handler L141-142 |
| 8 | Redirect target not allowlisted → 403 | ✅ | handler L145-146 |
| 9 | Allowlisted redirect → pass through 3xx + Location | ✅ | handler L148-152 |
| 10 | Max 6 MB (CL present) → 413 | ✅ | handler L164-167 |
| 11 | Max 6 MB (CL absent, buffered) → 413 | ✅ | handler L175-188 |
| 12 | 25s timeout → 504 JSON | ✅ | handler L113-114, L128-132 |
| 13 | Preserve Content-Type + Content-Length | ✅ | handler L156-162, L169, L194 |
| 14 | Specific-origin CORS only | ✅ | handler L41-46 |
| 15 | `Access-Control-Allow-Methods` | ✅ | handler L44 |
| 16 | All error responses JSON | ✅ | All use `jsonResponse()` |
| 17 | SSRF protection (private IPs) | ✅ | handler L37, L108, L145 |

---

## Detailed Observations

### Security — Good

- **`timingSafeEqual`**: Iterates `Math.max(len)`, seeds diff with `bufA.length ^ bufB.length`. No early return. Correct.
- **Dual auth**: Anon key in header + secret in `key` param. Both constant-time compared.
- **SSRF regex**: Covers `localhost`, `127.x`, `::1`, `10.x`, `172.16-31.x`, `192.168.x`, `169.254.x`. Matches before allowlist check.

### Architecture — Clean

- **Separation**: Deno globals isolated to `index.ts` (40 LOC). All logic in testable `proxy-handler.ts`.
- **DI**: `fetchImpl` and `timeoutMs` injectable for testing.
- **LOC**: handler 202 (slightly over 200 target but acceptable — mostly comments/types).

### Test Coverage — Adequate (14 tests)

- All 9 spec-required smoke tests present.
- Extra: OPTIONS preflight, 3 `timingSafeEqual` unit tests, invalid auth header.
- Timeout test uses `timeoutMs: 50` to avoid real 25s wait — good pattern.

---

## Residual Notes (Low Severity)

| # | Note | Severity |
|---|------|----------|
| R1 | No test for buffered 6 MB enforcement (no `Content-Length` path at L175-188). Only CL-present path tested. | Low — nice-to-have |
| R2 | `index.ts` has IDE-only Deno lint errors (expected — Deno globals not resolvable in VS Code TypeScript). Pre-existing; no runtime impact. | Info |
| R3 | `proxySecret` / `supabaseAnonKey` default to `""` if env unset (index.ts L26-27). Empty-string secrets will cause auth failures — correct fail-closed behavior, but no explicit 500 for "secrets not configured". | Info |
| R4 | Comment at handler L170 says "Stream" but response is fully buffered via `arrayBuffer()`. No behavioral issue — Deno serializes `Uint8Array` as body correctly. | Nit |

---

## Unresolved Questions

None.
