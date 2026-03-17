# Phase 05 — Improve Error Handling
**Priority:** P2 | **Status:** Todo | **Depends on:** Phase 04

## Context
After db.ts modularization, EditLinkDialog error handling is improved here.

## Fix 1: EditLinkDialog — Differentiate Error Types
**File:** `src/components/EditLinkDialog.tsx`

Already covered in Phase 03 Fix 3 (SHORT_CODE_TAKEN). This phase adds:
- Network error vs validation error distinction
- Better user-facing messages per error type

## Fix 2: CreateLinkDialog — Verify Existing Error Handling is Complete
**File:** `src/components/CreateLinkDialog.tsx` (197 lines — near limit)

Read and verify:
- All mutation error paths handled
- SHORT_CODE_TAKEN → field error (already done per scout report)
- Generic network errors → toast with retry suggestion

## Todo
- [ ] Re-read `src/components/EditLinkDialog.tsx` after Phase 03 changes
- [ ] Verify EditLinkDialog handles: SHORT_CODE_TAKEN, network failure, unknown
- [ ] Read `src/components/CreateLinkDialog.tsx` — verify error handling complete
- [ ] Ensure consistent error UX between Create and Edit dialogs
- [ ] Run `npm run test -- --run` → all pass

## Success Criteria
- Edit and Create dialogs show same quality of error messages
- SHORT_CODE_TAKEN always renders as a field error (not toast)
- Network/unknown errors render as descriptive toast
