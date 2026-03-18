# Set BYPASS_URL_ALLOWLIST Secret — Report

**Date**: 2026-03-18

---

## Result: ✅ Secret Set and Verified

### Secret Set
- **Command**: `npx supabase secrets set BYPASS_URL_ALLOWLIST="qrlive-jp-proxy.fly.dev,qrlive-sg-proxy.fly.dev"`
- **Exit code**: 0
- **Output**: "Finished supabase secrets set."

### Verification
- **Command**: `npx supabase secrets list`
- **Result**: `BYPASS_URL_ALLOWLIST` confirmed present in project secret list.

### Value Applied
```
qrlive-jp-proxy.fly.dev,qrlive-sg-proxy.fly.dev
```

---

## Follow-up

None required. The redirect edge function (deployed earlier) will now restrict bypass URLs to only these two Fly.io proxy hostnames. All other bypass URLs silently fall through to `target_url`.

---

## Unresolved Questions

None.
