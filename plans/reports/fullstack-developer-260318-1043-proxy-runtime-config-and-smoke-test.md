# Proxy Runtime Config & Smoke Test — Report

**Date**: 2026-03-18

---

## Secrets Configured

| Secret | Value Set | Status |
|--------|-----------|--------|
| `PROXY_SECRET` | 32-char random (not disclosed) | ✅ Set |
| `PROXY_ALLOWED_HOSTS` | `qrlive.vercel.app` | ✅ Set |
| `PROXY_ALLOWED_ORIGIN` | `https://qrlive.vercel.app` | ✅ Set |
| `SUPABASE_ANON_KEY` | (attempted) | ❌ Blocked — Supabase rejects secrets prefixed `SUPABASE_` |

Command used: `npx -y supabase secrets set PROXY_SECRET=... PROXY_ALLOWED_HOSTS=qrlive.vercel.app PROXY_ALLOWED_ORIGIN=https://qrlive.vercel.app`

---

## Smoke Test Results

| Test | HTTP Status | Body |
|------|-------------|------|
| Correct anon key + correct secret | 401 | `{"error":"Unauthorized"}` |
| Wrong anon key + correct secret | 401 | `{"error":"Unauthorized"}` |
| No auth header + correct secret | 401 | `{"error":"Unauthorized"}` |

Function was redeployed after setting secrets to force reload. All tests return 401.

---

## Root Cause

**`SUPABASE_ANON_KEY` is not available at runtime** as expected.

- Our `index.ts` reads `Deno.env.get("SUPABASE_ANON_KEY")` and defaults to `""` if unset.
- The handler then compares `timingSafeEqual(authHeader.slice(7), "")` which always returns false → 401.
- Supabase blocks setting secrets prefixed with `SUPABASE_` via `secrets set` (error: "Env name cannot start with SUPABASE_").
- The auto-injected `SUPABASE_ANON_KEY` is expected to be available in Supabase Edge Functions, but may not exist when deployed with `--no-verify-jwt`.

---

## Follow-Up Needed

Two options to unblock (lead decision):

### Option A: Use a custom env var name (recommended)
Change `index.ts` to read a non-reserved name (e.g., `PROXY_ANON_KEY`) instead of `SUPABASE_ANON_KEY`:
```typescript
supabaseAnonKey: Deno.env.get("PROXY_ANON_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "",
```
Then set via: `npx supabase secrets set PROXY_ANON_KEY=<anon-key>`

### Option B: Remove anon key auth layer
If the `key` param + CORS + allowlist are sufficient, remove the anon key check entirely. The `PROXY_SECRET` in the `key` param is already constant-time compared and provides authentication.

---

## Unresolved Questions

1. Does Supabase Edge Runtime auto-inject `SUPABASE_ANON_KEY` as a `Deno.env` variable? Documentation is ambiguous on whether `--no-verify-jwt` affects env var injection.
