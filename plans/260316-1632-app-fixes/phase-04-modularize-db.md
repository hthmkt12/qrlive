# Phase 04 — Modularize db.ts
**Priority:** P1 | **Status:** Todo

## Context
`src/lib/db.ts` — 252 lines, exceeds 200-line rule. Contains 4 distinct concerns.

## Split Plan

### Target structure:
```
src/lib/
├── db/
│   ├── models.ts        # Interfaces: QRLinkRow, GeoRouteRow, ClickEventRow, analytics types
│   ├── queries.ts       # Read ops: fetchLinks, fetchLinkAnalyticsSummaries, fetchLinkAnalyticsDetail
│   ├── mutations.ts     # Write ops: createLinkInDB, updateLinkInDB, updateGeoRoutesInDB, deleteLinkInDB, generateShortCode
│   └── utils.ts         # Helpers: getRedirectUrl, normalizeAnalyticsRows
├── db.ts                # Re-export barrel: export * from './db/models'; export * from './db/queries'; etc.
```

Keeping `src/lib/db.ts` as a barrel ensures zero breaking changes for all existing imports.

## Todo
- [ ] Read full `src/lib/db.ts` to map all exports
- [ ] Create `src/lib/db/models.ts` — move interfaces/types
- [ ] Create `src/lib/db/queries.ts` — move fetch functions
- [ ] Create `src/lib/db/mutations.ts` — move CRUD + generateShortCode
- [ ] Create `src/lib/db/utils.ts` — move getRedirectUrl + normalizeAnalyticsRows
- [ ] Rewrite `src/lib/db.ts` as re-export barrel
- [ ] Run `npm run typecheck` → 0 errors
- [ ] Run `npm run test -- --run` → all pass

## Files Modified
- `src/lib/db.ts` — convert to barrel
- `src/lib/db/models.ts` — new
- `src/lib/db/queries.ts` — new
- `src/lib/db/mutations.ts` — new
- `src/lib/db/utils.ts` — new

## Success Criteria
- No file in `src/lib/db/` exceeds 100 lines
- All existing imports from `src/lib/db` still resolve
- TypeScript: 0 errors, tests: all pass
