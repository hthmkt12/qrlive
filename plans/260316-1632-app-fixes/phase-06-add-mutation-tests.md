# Phase 06 — Add Mutation Hook Tests
**Priority:** P2 | **Status:** Todo | **Depends on:** Phase 04

## Context
`src/hooks/use-link-mutations.ts` (118 lines) has no dedicated unit tests.
Coverage only via component tests (indirect). Direct tests catch regressions earlier.

## Test File to Create
`src/test/use-link-mutations.test.ts`

## Test Cases

### useCreateLink
- [x] Creates link with auto-generated short code
- [x] Creates link with custom short code
- [x] Handles SHORT_CODE_TAKEN error → re-throws with correct message
- [x] Invalidates QUERY_KEYS.links on success

### useUpdateLink
- [x] Updates link name/URL
- [x] Invalidates QUERY_KEYS.links on success

### useToggleActive
- [x] Optimistically updates UI before server response
- [x] Rolls back on error (context.previous restored)
- [x] Calls setQueryData with toggled isActive

### useUpdateGeoRoutes
- [x] Calls updateGeoRoutesInDB with correct args
- [x] Invalidates cache on success

### useDeleteLink
- [x] Deletes link by id
- [x] Invalidates QUERY_KEYS.links on success

## Mocking Strategy
Follow existing test patterns (vi.hoisted + vi.mock):
```ts
// Mock db module
vi.mock('@/lib/db', () => ({
  createLinkInDB: vi.fn(),
  updateLinkInDB: vi.fn(),
  updateGeoRoutesInDB: vi.fn(),
  deleteLinkInDB: vi.fn(),
}));
```

Use `@testing-library/react` `renderHook` + `QueryClientProvider` wrapper.

## Todo
- [x] Read `src/hooks/use-link-mutations.ts` fully
- [x] Read existing hook test patterns (e.g. `src/test/auth-context.test.tsx`) for setup
- [x] Create `src/test/use-link-mutations.test.ts` with ~20 tests
- [x] Run `npm run test -- --run` → all pass including new tests

## Success Criteria
- `use-link-mutations` hook has ≥15 direct unit tests
- All happy paths + error paths tested
- Optimistic update rollback explicitly tested
- `npm run test -- --run` → all pass
