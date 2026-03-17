# Phase 01: Link Expiration Dates

## Context Links
- [System Architecture](../../docs/system-architecture.md)
- [Edge Function](../../supabase/functions/redirect/index.ts)
- [DB Models](../../src/lib/db/models.ts)

## Overview
- **Priority:** P1
- **Status:** Pending
- **Effort:** 4h
- Links auto-deactivate after user-specified expiration date. Expired links return 404 on redirect.

## Key Insights
- `qr_links` already has `is_active` boolean -- expiration is a time-based extension of this concept
- Edge function already checks `is_active` in the query filter -- add `expires_at` check there
- No cron needed: check at redirect time (KISS). Dashboard can show visual expired badge.

## Requirements

### Functional
- User sets optional expiration date when creating/editing a link
- Expired links return 404 on redirect (same as inactive)
- Dashboard shows expired badge on expired links
- User can clear expiration date (link becomes permanent again)
- User can extend expiration on already-expired links

### Non-Functional
- No background cron/worker needed
- Expiration check at redirect time adds negligible latency (single column comparison)

## Architecture

### Data Flow
```
User sets expires_at in Create/Edit dialog
  -> Stored in qr_links.expires_at (TIMESTAMPTZ, nullable)
  -> Edge function: WHERE is_active = true AND (expires_at IS NULL OR expires_at > now())
  -> Dashboard: compare expires_at vs now() for badge display
```

## DB Migration

**File:** `supabase/migrations/YYYYMMDDHHMMSS_add_expires_at_to_qr_links.sql`

```sql
ALTER TABLE public.qr_links
  ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Index for edge function filter performance
CREATE INDEX idx_qr_links_expires_at ON public.qr_links(expires_at)
  WHERE expires_at IS NOT NULL;

COMMENT ON COLUMN public.qr_links.expires_at IS 'Optional expiration timestamp. NULL = never expires.';
```

No RLS changes needed -- column inherits existing owner-only policies.

## Related Code Files

### Files to Modify
| File | Change |
|------|--------|
| `src/lib/db/models.ts` | Add `expires_at?: string \| null` to `QRLinkRow` |
| `src/lib/db/mutations.ts` | Accept `expires_at` in `createLinkInDB` and `updateLinkInDB` |
| `src/lib/schemas.ts` | Add optional `expiresAt` field to `linkFormSchema` |
| `src/components/CreateLinkDialog.tsx` | Add DatePicker for expiration |
| `src/components/EditLinkDialog.tsx` | Add DatePicker for expiration |
| `src/components/LinkCard.tsx` | Show expired/expiring badge |
| `supabase/functions/redirect/index.ts` | Add `expires_at` check to query |
| `src/integrations/supabase/types.ts` | Regenerate after migration |

### No New Files Needed

## Implementation Steps

1. **Create migration** adding `expires_at` column
2. **Run migration** locally: `supabase db push`
3. **Regenerate types**: `supabase gen types typescript --local > src/integrations/supabase/types.ts`
4. **Update `models.ts`**: Add `expires_at` field to `QRLinkRow`
5. **Update `schemas.ts`**: Add optional `expiresAt` (ISO string or empty) to `linkFormSchema`
6. **Update `mutations.ts`**:
   - `createLinkInDB`: accept `expiresAt` param, pass as `expires_at` to INSERT
   - `updateLinkInDB`: accept `expires_at` in updates object
7. **Update `use-link-mutations.ts`**: Pass `expiresAt` through mutation params
8. **Update `CreateLinkDialog.tsx`**: Add DatePicker field (use shadcn/ui Popover + Calendar)
9. **Update `EditLinkDialog.tsx`**: Same DatePicker, pre-fill with existing value
10. **Update `LinkCard.tsx`**: Show badge "Het han" (expired) or "Sap het han" (expiring soon, <24h)
11. **Update edge function**: Change query filter to include expiration check
12. **Run `npm run typecheck`** and fix any type errors
13. **Write tests**: Schema validation for expiresAt field

## Todo List

- [ ] 1.1 Create DB migration
- [ ] 1.2 Update `models.ts` with `expires_at` field
- [ ] 1.3 Update `schemas.ts` with `expiresAt` validation
- [ ] 1.4 Update `mutations.ts` to accept/pass `expires_at`
- [ ] 1.5 Update `use-link-mutations.ts` mutation params
- [ ] 1.6 Add DatePicker to `CreateLinkDialog.tsx`
- [ ] 1.7 Add DatePicker to `EditLinkDialog.tsx`
- [ ] 1.8 Add expired badge to `LinkCard.tsx`
- [ ] 1.9 Update edge function redirect query
- [ ] 1.10 Regenerate Supabase types
- [ ] 1.11 Write schema tests for expiresAt
- [ ] 1.12 Run typecheck and lint

## Success Criteria

- [ ] Link with past `expires_at` returns 404 on redirect
- [ ] Link with future `expires_at` redirects normally
- [ ] Link with NULL `expires_at` redirects normally (backward compatible)
- [ ] Dashboard shows expired badge
- [ ] User can set/clear/change expiration in Create and Edit dialogs
- [ ] All existing tests pass

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Timezone confusion (user vs server) | Store as UTC, display in user's local timezone via `toLocaleDateString` |
| Expired links still cached in browser | Edge function already sets `Cache-Control: no-store` |
| Migration on production Supabase | `ALTER TABLE ADD COLUMN` with DEFAULT NULL is non-blocking |

## Security Considerations
- No new auth/RLS changes needed -- column inherits row ownership policies
- Edge function uses service role -- expiration check is in the WHERE clause, not client-side
