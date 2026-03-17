# Phase 01 — Fix Failing Test
**Priority:** P0 | **Status:** Todo

## Context
- Report: `plans/reports/debugger-260316-1628-test-run-results.md`
- File: `src/test/edit-link-dialog.test.tsx:249`

## Problem
Test: `EditLinkDialog > removes a geo route when delete button is clicked`

Dialog renders via `DialogPortal` → mounts into `document.body`, NOT into `container`.
Querying `container.querySelectorAll(...)` returns 0 elements → `removeBtn` is undefined → assertion fails.

## Fix

**File:** `src/test/edit-link-dialog.test.tsx` line 249

```diff
- const allButtons = Array.from(container.querySelectorAll<HTMLButtonElement>('form button[type="button"]'));
+ const allButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('form button[type="button"]'));
```

## Todo
- [ ] Apply fix to `src/test/edit-link-dialog.test.tsx:249`
- [ ] Run `npm run test -- --run` and confirm 129/129 pass

## Success Criteria
`npm run test -- --run` → 129 passed, 0 failed
