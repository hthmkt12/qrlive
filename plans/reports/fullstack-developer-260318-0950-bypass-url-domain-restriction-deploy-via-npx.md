# Deploy: Bypass URL Domain Restriction — Edge Function (via npx)

**Date**: 2026-03-18
**Command**: `npx -y supabase functions deploy redirect --no-verify-jwt`

---

## Result: ✅ Deployment Succeeded

- Exit code: 0
- Project: `ybxmpuirarncxmenprzf`
- Warning: "Docker is not running" — informational only, does not block remote deployment

---

## Follow-up: BYPASS_URL_ALLOWLIST Configuration

The deployed function now supports the `BYPASS_URL_ALLOWLIST` env var. To activate domain restriction, set the secret:

```bash
npx supabase secrets set BYPASS_URL_ALLOWLIST="allowed-host-1.com,allowed-host-2.com"
```

If left unset, all bypass URLs remain allowed (backward-compatible default). No action needed if allow-all is the desired behavior.

---

## Unresolved Questions

None.
