# Phase 06 — Add Mutation Hook Tests
**Priority:** P2 | **Status:** Todo | **Depends on:** Phase 04

## Context
`src/hooks/use-link-mutations.ts` (118 lines) has no dedicated unit tests.
Coverage only via component tests (indirect). Direct tests catch regressions earlier.

## Test File to Create
`src/test/use-link-mutations.test.ts`

## Test Cases

### useCreateLink
- [ ] Creates link with auto-generated short code
- [ ] Creates link with custom short code
- [ ] Handles SHORT_CODE_TAKEN error → re-throws with correct message
- [ ] Invalidates QUERY_KEYS.links on success

### useUpdateLink
- [ ] Updates link name/URL
- [ ] Invalidates QUERY_KEYS.links on success

### useToggleActive
- [ ] Optimistically updates UI before server response
- [ ] Rolls back on error (context.previous restored)
- [ ] Calls setQueryData with toggled isActive

### useUpdateGeoRoutes
- [ ] Calls updateGeoRoutesInDB with correct args
- [ ] Invalidates cache on success

### useDeleteLink
- [ ] Deletes link by id
- [ ] Invalidates QUERY_KEYS.links on success

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
- [ ] Read `src/hooks/use-link-mutations.ts` fully
- [ ] Read existing hook test patterns (e.g. `src/test/auth-context.test.tsx`) for setup
- [ ] Create `src/test/use-link-mutations.test.ts` with ~20 tests
- [ ] Run `npm run test -- --run` → all pass including new tests

## Success Criteria
- `use-link-mutations` hook has ≥15 direct unit tests
- All happy paths + error paths tested
- Optimistic update rollback explicitly tested
- `npm run test -- --run` → all pass
