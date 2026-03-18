# Deploy Supabase Proxy Fallback — Report

**Date**: 2026-03-18

---

## Deployment Result

| Item | Value |
|------|-------|
| Status | ✅ Deployed |
| Command | `npx -y supabase functions deploy proxy --no-verify-jwt` |
| Exit code | 0 |
| Note | Docker warning (expected — edge functions deploy without local Docker) |

---

## Secrets Check

| Secret Name | Present? |
|-------------|----------|
| `PROXY_SECRET` | ❌ Not configured |
| `PROXY_ALLOWED_HOSTS` | ❌ Not configured |
| `PROXY_ALLOWED_ORIGIN` | ❌ Not configured (will default to `https://qrlive.vercel.app`) |
| `SUPABASE_ANON_KEY` | N/A — managed internally by Supabase runtime, not visible in `secrets list` |

---

## Follow-Up Needed

Before the proxy function is usable, set the required secrets:

```bash
npx supabase secrets set PROXY_SECRET=<your-random-secret>
npx supabase secrets set PROXY_ALLOWED_HOSTS=<comma-separated-hostnames>
# Optional — only if you need a different CORS origin:
npx supabase secrets set PROXY_ALLOWED_ORIGIN=https://qrlive.vercel.app
```

Without `PROXY_SECRET` and `PROXY_ALLOWED_HOSTS`, the function will return 401 or 500 for all requests (fail-closed behavior).

---

## Unresolved Questions

None.
