# Phase Implementation Report

## Executed Phase
- Phase: Phase 01 — Link Expiration + SELECT * Security Pre-fix
- Plan: plans/260316-1701-q2-features/
- Status: completed

## Files Modified

| File | Lines | Change |
|------|-------|--------|
| `src/lib/db/queries.ts` | 77 | `select('*')` → explicit column list incl. `expires_at` |
| `src/lib/db/models.ts` | 64 | Added `user_id`, `expires_at: string \| null` to `QRLinkRow`; `created_at?` to `GeoRouteRow` |
| `src/lib/schemas.ts` | 35 | Added optional `expiresAt` field to `linkFormSchema` |
| `src/lib/db/mutations.ts` | 116 | Added `expiresAt` param to `createLinkInDB`; `expires_at` to `updateLinkInDB` updates type |
| `src/hooks/use-link-mutations.ts` | 120 | Added `expiresAt` to `useCreateLink` params; `expires_at` to `useUpdateLink` updates type |
| `src/components/CreateLinkDialog.tsx` | 204 | Added "Ngày hết hạn" date input; passes `expiresAt` to mutation |
| `src/components/EditLinkDialog.tsx` | 194 | Added "Ngày hết hạn" date input; pre-fills from `link.expires_at`; passes `expires_at` to mutation |
| `src/components/LinkCard.tsx` | 191 | Added expiration badge ("Đã hết hạn" / "Hết hạn: DD/MM/YYYY") |
| `supabase/functions/redirect/index.ts` | ~138 | Explicit column select; 410 Gone response when `expires_at` past |
| `supabase/migrations/20260316100000_add_link_expiration.sql` | 8 | New migration: ADD COLUMN + partial index |
| `src/test/db-utils.test.ts` | — | Updated expected select string |
| `src/test/use-link-mutations.test.ts` | — | Updated `mockLink` shape; added 6th arg `undefined` to `createLinkInDB` assertions |
| `src/test/link-card.test.tsx` | — | Added `expires_at: null` to `mockLink` |
| `src/test/edit-link-dialog.test.tsx` | — | Added `expires_at: null` to `mockLink`; updated `updateLink` call expectation |
| `src/test/create-link-dialog.test.tsx` | — | Added `expiresAt: null` to two `mutateAsync` call expectations |

## Tasks Completed

- [x] STEP 0: Fix `SELECT *` → explicit columns (includes `expires_at`) in `fetchLinks`
- [x] STEP 2: DB migration `20260316100000_add_link_expiration.sql`
- [x] STEP 3: `QRLinkRow` gains `user_id` + `expires_at: string | null`; `GeoRouteRow` gains `created_at?`
- [x] STEP 4: `linkFormSchema` gains optional `expiresAt` string field
- [x] STEP 5: `createLinkInDB` accepts `expiresAt`; `updateLinkInDB` accepts `expires_at`
- [x] STEP 6: Edge function: explicit column select + 410 Gone with Vietnamese HTML for expired links
- [x] STEP 7: `useCreateLink` / `useUpdateLink` types updated
- [x] STEP 7: `CreateLinkDialog` — "Ngày hết hạn" date input added
- [x] STEP 8: `EditLinkDialog` — same date input, pre-filled from existing `expires_at`
- [x] STEP 9: `LinkCard` — expiration badge (red "Đã hết hạn" / amber "Hết hạn: DD/MM/YYYY")
- [x] STEP 10: All tests updated to match new signatures/shapes

## Tests Status
- Type check: **pass** (0 errors)
- Unit tests: **141/141 passed** (10 test files)
- Lint: **0 errors** (1 pre-existing warning in auth-context.tsx, unrelated)

## Issues Encountered

- `QRLinkRow` was missing `user_id` and `expires_at`; existing tests in `link-card.test.tsx` and `edit-link-dialog.test.tsx` already referenced `user_id` — added both fields to model
- `GeoRouteRow` missing `created_at` that existing tests referenced — added as optional field
- `use-link-mutations.test.ts` had `updated_at` on mockLink (field removed from model) — fixed
- `CreateLinkDialog.tsx` hit 204 lines (4 over guideline). Component is a single cohesive dialog; splitting 4 lines would violate KISS. Accepted as-is per "Prioritize functionality and readability" rule.

## Next Steps
- Phase 02 (Password Protection) can now safely add `password_hash` column — `fetchLinks` no longer uses `SELECT *`
- Run `supabase db push` to apply migration on local/staging
