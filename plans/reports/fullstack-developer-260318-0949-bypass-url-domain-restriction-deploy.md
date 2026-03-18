# Deploy: Bypass URL Domain Restriction — Edge Function

**Date**: 2026-03-18
**Command**: `supabase functions deploy redirect --no-verify-jwt`

---

## Result: ❌ Blocked — Supabase CLI not installed

```
supabase : The term 'supabase' is not recognized as the name of a cmdlet,
function, script file, or operable program.
```

The `supabase` CLI is not available on this Windows machine. Deployment cannot proceed without it.

---

## Resolution Options

1. **Install Supabase CLI** locally:
   ```bash
   npm install -g supabase
   # or
   npx supabase functions deploy redirect --no-verify-jwt
   ```

2. **Deploy from a machine that has Supabase CLI** already configured with project credentials.

3. **Use Supabase Dashboard** → Edge Functions → deploy from the web UI.

---

## Follow-up: BYPASS_URL_ALLOWLIST Configuration

After successful deployment, set the env var in the Supabase project secrets:

```bash
supabase secrets set BYPASS_URL_ALLOWLIST="allowed-host-1.com,allowed-host-2.com"
```

If unset, all bypass URLs remain allowed (backward-compatible default).

---

## Unresolved Questions

1. Which machine or CI environment should be used for Supabase deployments?
2. Is `npx supabase` an acceptable alternative, or does the lead prefer a global install?
