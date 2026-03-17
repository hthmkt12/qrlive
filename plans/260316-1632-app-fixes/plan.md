# QRLive App Fixes Plan
**Date:** 2026-03-16 | **Branch:** master | **Status:** ✅ Completed (2026-03-16)

## Context
Analysis by 3 parallel agents (scout + debugger + security). Full reports:
- `plans/reports/debugger-260316-1628-test-run-results.md`

---

## Issues Found

### Tests: 128/129 pass (1 failing)
- **FAIL** `EditLinkDialog > removes a geo route when delete button is clicked`
  - Root cause: `container.querySelectorAll(...)` misses React portal (renders to `document.body`)
  - Fix: `document.querySelectorAll(...)` at `src/test/edit-link-dialog.test.tsx:249`

### Lint: 4 errors
- `src/components/ui/command.tsx:24` — `no-empty-object-type` (shadcn boilerplate)
- `src/components/ui/textarea.tsx:5` — `no-empty-object-type` (shadcn boilerplate)
- `src/test/link-card.test.tsx:32` — `no-explicit-any`
- `src/test/qr-preview.test.tsx:16` — `no-explicit-any`

### Code Quality
- `src/lib/db.ts` — 252 lines (exceeds 200-line limit) → needs modularization
- `src/components/EditLinkDialog.tsx` — generic error handling (no SHORT_CODE_TAKEN distinction)
- `src/hooks/use-link-mutations.ts` — no dedicated unit tests

### Security
- `src/lib/db.ts:144` — `Math.random()` for short code (not crypto-safe)
- `src/pages/Auth.tsx:34` — raw Supabase error exposed (user enumeration risk)
- `src/components/EditLinkDialog.tsx:63-81` — generic catch, no error differentiation

---

## Phases

| Phase | Title | Priority | Est. Scope |
|-------|-------|----------|------------|
| [01](./phase-01-fix-failing-test.md) | Fix failing test | P0 | ✅ Done |
| [02](./phase-02-fix-lint-errors.md) | Fix lint errors | P0 | ✅ Done |
| [03](./phase-03-security-fixes.md) | Security fixes | P1 | ✅ Done |
| [04](./phase-04-modularize-db.md) | Modularize db.ts | P1 | ✅ Done |
| [05](./phase-05-improve-error-handling.md) | Improve error handling | P2 | ✅ Done |
| [06](./phase-06-add-mutation-tests.md) | Add mutation hook tests | P2 | ✅ Done |

---

## Dependencies
- Phase 01, 02 independent → run first/parallel
- Phase 03 independent of 01/02
- Phase 04 must complete before Phase 05 (EditLinkDialog imports from db.ts)
- Phase 06 can run after Phase 04
