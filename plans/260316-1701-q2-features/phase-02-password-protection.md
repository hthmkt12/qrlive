# Phase 02: Password-Protected Links

## Context Links
- [System Architecture](../../docs/system-architecture.md)
- [Edge Function](../../supabase/functions/redirect/index.ts)
- [DB Mutations](../../src/lib/db/mutations.ts)

## Overview
- **Priority:** P1
- **Status:** Pending
- **Effort:** 5h
- Links optionally require a password before redirecting. Visitor sees a password form served by the edge function.

## Key Insights
- Password hash stored in `qr_links` table -- never store plaintext
- Edge function handles password verification server-side (no client-side check)
- Use Web Crypto API (available in Deno) for SHA-256 hashing -- simple, no dependencies
- Password form is a minimal HTML page returned by edge function (no React needed for redirect flow)

## Requirements

### Functional
- User sets optional password when creating/editing link
- User can clear password (link becomes public again)
- Visitor accessing protected link sees HTML form asking for password
- Correct password redirects; wrong password shows error
- Password is hashed before storage (SHA-256 with salt)

### Non-Functional
- Password form must be lightweight HTML (no JS framework)
- Form submits via POST to same edge function URL
- Brute force mitigation via existing rate limiter (1 req/IP/60s already in place)

## Architecture

### Data Flow
```
Create/Edit: user enters password
  -> Frontend hashes: SHA-256(salt + password)
  -> Store hash + salt in qr_links.password_hash, qr_links.password_salt

Redirect flow:
  GET /redirect/{code}
    -> Link has password_hash? Serve HTML password form
    -> POST /redirect/{code} with password in body
    -> Edge function: hash submitted password with stored salt
    -> Match? 302 redirect. No match? Re-render form with error.
```

## DB Migration

**File:** `supabase/migrations/YYYYMMDDHHMMSS_add_password_to_qr_links.sql`

```sql
ALTER TABLE public.qr_links
  ADD COLUMN password_hash TEXT DEFAULT NULL,
  ADD COLUMN password_salt TEXT DEFAULT NULL;

COMMENT ON COLUMN public.qr_links.password_hash IS 'SHA-256 hash of salt+password. NULL = no password required.';
COMMENT ON COLUMN public.qr_links.password_salt IS 'Random salt for password hashing.';
```

No RLS changes needed -- columns inherit existing owner-only policies.

## Related Code Files

### Files to Modify
| File | Change |
|------|--------|
| `src/lib/db/models.ts` | Add `password_hash`, `password_salt` to `QRLinkRow` (optional) |
| `src/lib/db/mutations.ts` | Accept password param, hash + store |
| `src/lib/schemas.ts` | Add optional `password` field to `linkFormSchema` |
| `src/components/CreateLinkDialog.tsx` | Add password input toggle |
| `src/components/EditLinkDialog.tsx` | Add password input toggle + clear option |
| `src/components/LinkCard.tsx` | Show lock icon when password-protected |
| `supabase/functions/redirect/index.ts` | Handle GET (serve form) + POST (verify) for protected links |

### New Files
| File | Purpose |
|------|---------|
| `src/lib/password-utils.ts` | `hashPassword(password, salt)` and `generateSalt()` -- shared between frontend and edge function |

## Implementation Steps

1. **Create migration** adding `password_hash` and `password_salt` columns
2. **Run migration** locally
3. **Regenerate types**
4. **Create `password-utils.ts`**: SHA-256 hashing using Web Crypto API (works in browser + Deno)
   ```typescript
   export function generateSalt(): string { return crypto.randomUUID(); }
   export async function hashPassword(password: string, salt: string): Promise<string> {
     const encoder = new TextEncoder();
     const data = encoder.encode(salt + password);
     const hash = await crypto.subtle.digest("SHA-256", data);
     return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
   }
   ```
5. **Update `models.ts`**: Add optional `password_hash`, `password_salt` to `QRLinkRow`
6. **Update `schemas.ts`**: Add optional `password` (min 4 chars if provided) to `linkFormSchema`
7. **Update `mutations.ts`**:
   - `createLinkInDB`: if password provided, hash it and store hash+salt
   - `updateLinkInDB`: accept `password` or `clearPassword` flag
8. **Update `use-link-mutations.ts`**: Pass password through
9. **Update `CreateLinkDialog.tsx`**: Add password input with show/hide toggle
10. **Update `EditLinkDialog.tsx`**: Add password input, checkbox "Remove password"
11. **Update `LinkCard.tsx`**: Show lock icon (lucide `Lock`) when `password_hash` is set
12. **Update edge function**:
    - On GET: if link has `password_hash`, return HTML form (minimal, styled, Vietnamese text)
    - On POST: parse body, hash submitted password with stored salt, compare
    - Match: proceed to redirect (record click as normal)
    - No match: return form again with error message
    - IMPORTANT: exclude `password_hash` and `password_salt` from any JSON error responses
13. **Write tests**: Schema validation, password hashing utility
14. **Run typecheck and lint**

## Todo List

- [ ] 2.1 Create DB migration
- [ ] 2.2 Create `src/lib/password-utils.ts`
- [ ] 2.3 Update `models.ts`
- [ ] 2.4 Update `schemas.ts` with password validation
- [ ] 2.5 Update `mutations.ts` for password hashing
- [ ] 2.6 Update `use-link-mutations.ts`
- [ ] 2.7 Add password input to `CreateLinkDialog.tsx`
- [ ] 2.8 Add password input to `EditLinkDialog.tsx`
- [ ] 2.9 Add lock icon to `LinkCard.tsx`
- [ ] 2.10 Update edge function: GET serves form, POST verifies
- [ ] 2.11 Regenerate Supabase types
- [ ] 2.12 Write tests for password utils and schema
- [ ] 2.13 Run typecheck and lint

## Success Criteria

- [ ] Protected link GET returns HTML password form
- [ ] Correct password redirects with 302
- [ ] Wrong password re-shows form with Vietnamese error
- [ ] Unprotected links redirect as before (backward compatible)
- [ ] Password hash never exposed in responses or frontend
- [ ] Dashboard shows lock icon on protected links
- [ ] User can set/clear password in Create and Edit dialogs
- [ ] All existing tests pass

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Password bruteforce | Existing rate limiter (1 req/IP/60s); optionally add attempt counter later |
| Password hash exposed in SELECT | Frontend `fetchLinks` already does `select(*)` -- exclude hash fields in query or strip from response. Better: use `.select("id, name, short_code, ...")` explicit list |
| SHA-256 without bcrypt | Acceptable for link passwords (not user accounts). Salt prevents rainbow tables. Can upgrade to bcrypt later if needed. |
| Edge function POST parsing | Deno supports `req.formData()` natively -- use it for form submissions |

## Security Considerations
- **Never return** `password_hash` or `password_salt` to frontend -- modify `fetchLinks` query to exclude them, or strip in JS
- Salt is per-link, stored alongside hash
- Form uses POST (not GET) to prevent password in URL/logs
- HTML form includes CSRF-safe design (no session to hijack, stateless verify)
- Rate limiting already in place at edge function level
