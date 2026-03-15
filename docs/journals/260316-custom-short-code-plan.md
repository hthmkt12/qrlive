# Custom Short Code Feature Plan — Unstarted

**Date:** 2026-03-16 02:55 UTC
**Severity:** Low (planned feature, never executed)
**Component:** Link creation flow — custom short code support
**Status:** Archived (Ready to implement, but task never claimed)

## What Happened

Planned a 4-phase feature allowing users to set custom short codes when creating redirect links. Format: `[A-Za-z0-9_-]{3,20}`. Default behavior unchanged — blank field auto-generates random code.

Plan was fully designed, documented, and marked "Ready to implement" on 2026-03-16, but all 4 task phases remained Todo. Plan was never picked up or executed.

## Why This Matters

This was a straightforward, low-risk enhancement. Clean scope, minimal code surface (4 files), no DB migration. Perfect candidate for quick implementation. Yet it wasn't started.

## Technical Design Decisions

**Schema layer** (`src/lib/schemas.ts`):
- Regex validation: `/^[A-Za-z0-9_-]{3,20}$/`
- Optional field — empty string/undefined triggers auto-generate fallback
- Uniqueness check deferred to DB layer (not schema, per KISS principle)

**DB layer** (`src/lib/db.ts`):
- Normalize to UPPERCASE before storage (consistency with auto-generated codes)
- Check uniqueness synchronously with `maybeSingle()` query
- Throw `Error("SHORT_CODE_TAKEN")` — specific error contract for UI to handle

**Mutation hook** (`src/hooks/use-link-mutations.ts`):
- Thread optional param through `useCreateLink()` — minimal change
- No validation logic here, deferred to schema + DB

**UI layer** (`src/components/CreateLinkDialog.tsx`):
- Input displayed with `/r/` visual prefix (UX hint, not functional)
- CSS `uppercase` for visual feedback (actual normalization in DB)
- Catch `SHORT_CODE_TAKEN` error, show localized Vietnamese message

## Design Insights

**Strengths:**
- Layered validation: schema → DB uniqueness → error handling. Clear separation of concerns.
- Auto-generate fallback means feature is non-breaking — existing flows unaffected
- No DB schema changes = simpler, faster ship

**Assumptions:**
- `short_code` column already nullable/handles uppercase storage (verified in plan)
- UI client catches and localizes error messages (pattern already established)
- Uniqueness check is sufficient — no index optimization added (probably acceptable given link volume)

**Potential issues not addressed:**
- No rate limiting on custom code attempts (spam could enumerate namespace)
- No "suggest me a code" UX feature (users must come up with valid code themselves)
- Real-time availability check not implemented (KISS decision, but UX friction)

## Why It Was Archived

Plan created early in session (2026-03-16 00:55), but higher-priority work likely consumed capacity. Feature complexity is genuinely low, so this should be first pick-up for next sprint if custom codes become priority.

## Lessons

Good planning doesn't guarantee execution. A well-designed, low-complexity feature can still sit unstarted due to:
- Task prioritization downstream (roadmap shift)
- Token/resource allocation to higher-impact work
- Team context switching

If this feature re-surfaces, implementation is **straightforward**: 4 files, ~80 LOC total, no migrations, error handling pattern already in codebase. Should take ~30 min with test pass.

## Next Steps

- Re-evaluate feature priority (user demand? roadmap alignment?)
- If green-lit: assign as single task, expect <1 session delivery
- Consider bundling with other UX improvements to link creation flow
