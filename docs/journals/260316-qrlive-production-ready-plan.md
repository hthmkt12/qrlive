# QRLive Production Ready Plan — Unexecuted Blueprint

**Date:** 2026-03-16
**Plan Created:** 2026-03-15 22:45
**Status:** Archived/Unexecuted (All 54 tasks Todo)
**Severity:** Medium
**Component:** QRLive (Dynamic QR + Link Shortener)

---

## What Happened

A comprehensive 9-phase production readiness plan was created for QRLive but never executed. 54 tasks across cleanup, auth, validation, React Query migration, edge function hardening, UI polish, testing, deployment, and a new bypass URL feature. Plan marked "Ready to implement" but remains completely unstarted.

---

## The Brutal Truth

This is frustrating because it represents real planning effort that went to waste. Someone spent time understanding the codebase, identifying technical debt, architecting solutions for auth/validation/query management—and none of it materialized. The plan sits as a ghost document while the codebase likely accumulates more debt. No clear reason documented for why execution never happened. Was it deprioritized? Did other work take over? Product shift? We don't know. That's the worst part—lack of closure or explanation.

---

## Technical Details

**App:** Dynamic QR code + geo-routed link shortener with click analytics. React 18/TypeScript/Vite frontend. Supabase backend (Postgres + Edge Functions). Vietnamese UI.

**Architecture Planned:**
- **Auth Layer:** Supabase email/password auth + RLS policies per user (currently 100% public)
- **Query State:** React Query hooks with 10s refetch intervals (currently manual setState + setInterval)
- **Validation:** Zod schemas centralized in `lib/schemas.ts` for link creation/geo routes/auth
- **Edge Function Hardening:** Remove ip-api.com free tier (45 req/min rate limit), use Cloudflare `cf-ipcountry` header only. Bot filtering via user-agent regex. Cache-Control headers. Service role key for RLS bypass.
- **Deployment:** Vercel frontend + Supabase backend. `vercel.json` SPA routing. TypeScript build checks.

**Key Files Targeted:**
- `src/lib/db.ts` (hardcoded URLs, db operations)
- `src/lib/store.ts` (dead code to remove)
- `src/pages/Index.tsx` (manual state management)
- `supabase/functions/redirect/index.ts` (edge function latency issue)
- New: `src/contexts/auth-context.tsx`, `src/hooks/use-links.ts`, `src/lib/query-keys.ts`, `vercel.json`

**Execution Order Recommended:**
Phase 01 (cleanup) → Phase 02 (auth foundation) → Partial Phase 08 (Supabase deploy) → Phase 03–05 (features) → Phase 09 (bypass URL) → Phase 06–07 (UX/tests) → Phase 08 (frontend deploy)

---

## Why It Was Archived

Plan was created but no follow-up work initiated. Possible reasons (unconfirmed):
- Deprioritized in favor of other features
- Team capacity constraints (other projects demanded attention)
- Waiting for product requirements clarification
- Technical review identified blockers not documented
- One-off planning exercise without commitment to execute

**No post-plan review meeting or decision artifact found.**

---

## Key Technical Insights Captured

**Auth Gap is Real:** App currently public. Any user can delete/modify any QR link. Plan correctly identifies this as 🔴 critical.

**Performance Issue Identified:** Edge function depends on ip-api.com free tier (45 req/min). Under production load, this becomes bottleneck. Plan proposes Cloudflare header as single source of truth (zero latency, no rate limits).

**Query State Fragmentation:** React Query installed + QueryClientProvider mounted but unused. Current code uses manual `useState` + `setInterval(10000)`. Plan recognizes this and defines clear hook abstraction (useLinks, useLinkMutations).

**Data Validation Not Enforced:** No schema validation layer. Plan introduces centralized Zod schemas for create/update operations.

**Bot Traffic Unfiltered:** Click events include bot traffic (no user-agent filtering in edge function).

**Dependency Cleanup Identified:** 7 unused packages (`vaul`, `cmdk`, `embla-carousel`, `react-resizable-panels`, `input-otp`, `date-fns`) bloat bundle.

---

## Lessons Learned

1. **Plans Need Execution Commitment:** Creating a detailed plan without committed resources or timeline approval sets up psychological failure. Team feels plan exists "when we have time"—which never comes.

2. **Critical Path Should Be Obvious:** Phase ordering was well thought out (cleanup → auth → deploy → features), but without sprint assignment, context gets lost.

3. **Technical Debt Accumulates Faster Than Fixes:** The gap between "plan created" and "plan executed" is when new feature requests land. Cleanup work gets pushed further back.

4. **Document Blocker Decision:** If plan was cancelled/deprioritized, document it. "Archived 2026-03-16: Deprioritized for X-feature roadmap" is infinitely better than mysterious abandonment.

5. **Edge Function Optimization is Cheap Win:** The ip-api.com removal + Cloudflare header swap is straightforward perf improvement (~200-500ms latency reduction per redirect). This should have been p0.

---

## Next Steps

**For this plan specifically:**
- [ ] Document explicit decision: archived, deprioritized, or pending resources?
- [ ] Extract quick wins (Phase 05 TASK-22: ip-api.com removal) and treat as independent p0 fix
- [ ] If auth is still needed: spin Phase 02 into standalone task (critical security gap)
- [ ] If plan is actually needed: create sprint with assigned tasks + completion deadline

**For future planning:**
- Require explicit execution commitment before creating detailed plans
- Link plan to roadmap milestone + sprint dates
- Set 1-week time limit on plan age without execution before reviewing relevance

---

## Unresolved Questions

- Why was plan abandoned? Deprioritization decision not documented.
- Is auth still needed or was threat model reassessed?
- Did ip-api.com performance issues ever surface in production?
- Are there newer plans that supersede this one?
