# Scope & Complexity Critique — QRLive Production Ready Plan

**Reviewer:** Scope & Complexity Critic (YAGNI Enforcer)
**Plan:** `plans/260315-2245-qrlive-production-ready/`
**Date:** 2026-03-16

---

## Finding 1: Phase 09 Is Pre-MVP Scope Creep Disguised as "High Priority"

- **Severity:** Critical
- **Location:** Phase 09, Overview + plan.md Phase Overview table
- **Flaw:** The plan assigns "High" priority to the bypass URL feature — a niche, opt-in geo-routing override — while mandatory deployment infrastructure (Phase 08) is split mid-plan and basic E2E tests (Phase 07) are "Medium". This feature is not needed for production launch. It exists for a specific use case (users in censored countries using mirror URLs), which can ship in v2 after validating the core product works.
- **Failure scenario:** The team burns 8 tasks (TASK-47 to TASK-54) — a DB migration, type regeneration, edge function logic change, UI changes across 2 dialogs, a new badge, schema update — all before testing (Phase 07) is complete. If any prior phase has a breaking bug, these 8 tasks are wasted work. The UI complexity of a collapsible per-route bypass field inside an already-complex geo-routing dialog is disproportionate to the feature's use base at launch.
- **Evidence:** `"Priority: 🟠 High"` on Phase 09. Phase 07 Testing is `🟡 Medium`. A feature ranked above tests is YAGNI violation.
- **Suggested fix:** Demote Phase 09 to post-launch v2 scope. Remove from this plan entirely. A single-column nullable DB field is trivially addable later.

---

## Finding 2: Optimistic Update for Toggle Active Is Premature Over-Engineering

- **Severity:** High
- **Location:** Phase 04, TASK-19 `useLinkMutations hook`
- **Flaw:** The plan mandates optimistic update for `useToggleActive()` — flip `is_active` locally before server confirms. Optimistic UI requires rollback logic on error, cache reconciliation, and careful state management with React Query. For a toggle on a personal dashboard with zero concurrency conflicts (single user owns all links), optimistic update adds non-trivial complexity for zero perceived benefit.
- **Failure scenario:** If the Supabase update fails (network error, RLS rejection), the UI shows the link as active but the DB has it inactive. The rollback must correctly revert the query cache. Without a tested rollback path (the test plan in Phase 07 does not test this scenario), a user may believe a link is live when it is not — a functional correctness bug in a production QR link manager.
- **Evidence:** `"useToggleActive() — optimistic update: flip is_active locally trước khi server confirm (optional)"` — but labeled optional does not remove the implementation pressure from the task checklist.
- **Suggested fix:** Remove optimistic update. Use simple `invalidateQueries` on success like the other mutations. The 200ms extra latency on a management dashboard toggle is imperceptible.

---

## Finding 3: React Query Migration Is a Full Refactor Mid-Plan with No Fallback

- **Severity:** High
- **Location:** Phase 04, Overview + TASK-20/21
- **Flaw:** Migrating from `useState + setInterval` to React Query touches `Index.tsx`, `CreateLinkDialog`, `EditLinkDialog`, and `LinkCard` simultaneously. This is a full data-layer refactor across 4 components in one phase. The plan has no incremental migration path or fallback. If React Query introduces a regression (stale cache, wrong invalidation, query key mismatch), the app is broken across all CRUD paths at once.
- **Failure scenario:** A developer completes TASK-20 (removes `setInterval`, replaces with `useLinks()`) but TASK-21 (refactor dialogs to receive mutations as props) breaks prop contracts in `CreateLinkDialog`. The app crashes on link creation. Since the whole data layer was swapped, rolling back means reverting 4 files simultaneously rather than isolating the issue.
- **Evidence:** "Xóa `useState` cho `links`, `loading`", "Xóa `useCallback(refresh)` + `setInterval`" — all in one task, no incremental step.
- **Suggested fix:** Migrate `useLinks` first (read path only), verify it works, then migrate mutations one at a time. Keep `setInterval` as fallback until React Query is verified.

---

## Finding 4: Bypass URL Feature Adds a Third URL Tier with No Data Model Justification

- **Severity:** High
- **Location:** Phase 09, TASK-49 + Edge Function flow diagram
- **Flaw:** The bypass_url creates a three-tier URL priority chain: `bypass_url → target_url → default_url`. This is a three-level routing decision inside the edge function where previously there were two. The semantic distinction between "target_url" and "bypass_url" for the same geo_route is conceptually redundant — both are per-country destination URLs. A user can already achieve the same result by setting `target_url` to the bypass/mirror URL.
- **Failure scenario:** A user sets both `target_url = https://example.com` and `bypass_url = https://mirror.com` for Vietnam. They update `target_url` to a new domain but forget `bypass_url` still overrides it. Traffic silently goes to the stale mirror. The plan offers no UI indication in the routing flow that bypass takes precedence. The LinkCard badge ("bypass" icon) is cosmetic and does not prevent this confusion.
- **Evidence:** `"geo_route có bypass_url? → redirect bypass_url"` — bypass unconditionally overrides target_url for the same route, which is a silent override footgun.
- **Suggested fix:** Remove bypass_url as a separate column. If users need a mirror URL for a country, they set it as `target_url`. The bypass concept is an application-level convention, not a data model primitive.

---

## Finding 5: Phase 06 Includes Light/Dark Theme Toggle — Unshipped Core Feature Blocked by Polish

- **Severity:** High
- **Location:** Phase 06, TASK-33
- **Flaw:** TASK-33 requires wiring up `next-themes`, adding light mode CSS variables across `index.css`, and adding a toggle button to the header. This is a medium-complexity theming task that touches global CSS and app structure. It is in a phase labeled "Polish" but modifies the same files as Phase 02 (App.tsx) and risks CSS regression. More critically, the plan recommends executing Phase 06 before Phase 07 (testing) — meaning theme CSS changes are untested.
- **Failure scenario:** Adding light mode CSS variables to `index.css` breaks the dark mode color contrast. Since there are no visual regression tests in Phase 07, this ships to production undetected. The plan's success criteria for Phase 06 does not mention theme correctness.
- **Evidence:** Phase 06 success criteria: "Loading state, Empty state, Mobile layout, Confirm dialog, Copy feedback" — no mention of theme correctness. TASK-33 is in the same phase but its success criteria are absent.
- **Suggested fix:** Defer TASK-33 to post-launch. The app currently has dark mode. Shipping with dark-only is acceptable for v1.

---

## Finding 6: E2E Test Requires External Test Account — Plan Has No Test Data Strategy

- **Severity:** High
- **Location:** Phase 07, TASK-38
- **Flaw:** The E2E test spec `create-and-redirect.spec.ts` starts with "Login với test account" but the plan provides no specification for how this test account is provisioned, what credentials it uses, how it is isolated between runs, or how it avoids polluting production data. The plan's execution order places testing after full Supabase deployment — meaning the E2E test runs against the production Supabase project.
- **Failure scenario:** The E2E test creates real `qr_links` rows in the production database on every CI run. Either the test leaks data (rows accumulate) or a test cleanup step is needed (not planned). If tests share a single hardcoded test account, parallel CI runs conflict. If the test account credentials are stored in the repo, that is a security violation per the project's pre-commit rules.
- **Evidence:** `"Login với test account"` — no account provisioning, no cleanup, no isolation strategy in TASK-38 or Phase 08.
- **Suggested fix:** Either use Supabase's local emulator for E2E (already available via `supabase start`) or add explicit test data setup/teardown with a dedicated test user created via service role, documented in the task.

---

## Finding 7: Phase 08 Is Split Across Two Execution Points — Deployment Is Not Atomic

- **Severity:** Medium
- **Location:** Phase 08 + plan.md Recommended Execution Order
- **Flaw:** The recommended execution order is `Phase 01 → Phase 02 → Phase 08 (TASK-40–42) → ... → Phase 08 (TASK-43–46)`. Phase 08 is split: Supabase migrations deploy early (TASK-41–42), frontend deploys last (TASK-43–46). This means there is a window where production Supabase has the new `user_id` column and RLS policies, but the frontend code has not been deployed. Any existing users hitting the old frontend against the new RLS will get 403/empty responses.
- **Failure scenario:** A developer runs `supabase db push` (TASK-41) adding RLS requiring `user_id`, then spends 2 days implementing Phases 03–07 before deploying the frontend. During this window, if the old frontend is still live (not the case for a new app, but realistic if there are existing users), all link fetches return empty because RLS now requires `auth.uid() = user_id` but old clients send unauthenticated requests.
- **Evidence:** `"Phase 01 → Phase 02 → Phase 08 (TASK-40–42) → Phase 03 → Phase 04 → Phase 05 → Phase 09 → Phase 06 → Phase 07 → Phase 08 (TASK-43–46)"`
- **Suggested fix:** Keep Phase 08 atomic — deploy Supabase AND frontend together as the final step. Use Supabase local dev for all intermediate phases.

---

## Finding 8: TASK-25 Bot Detection via User-Agent Regex Is Security Theater

- **Severity:** Medium
- **Location:** Phase 05, TASK-25
- **Flaw:** The plan adds a regex check `bot|crawler|spider|prerender|headless` on the User-Agent to skip click_event inserts. Any malicious actor inflating click counts sets a custom User-Agent (e.g. `Mozilla/5.0`). This check catches only well-behaved crawlers that already respect robots.txt. It does not prevent click fraud, which is the actual threat model for an analytics system.
- **Failure scenario:** A competitor or tester runs `curl -A "Mozilla/5.0" https://qr.example.com/ABC123` in a loop. Every request bypasses the bot filter and inserts a click_event. The analytics dashboard shows inflated click counts. The plan has no rate limiting, no IP dedup, and no click validation beyond User-Agent string matching.
- **Evidence:** `"skip insert nếu match common bot patterns: bot|crawler|spider|prerender|headless"` — this is client-controlled input.
- **Suggested fix:** Either accept click inflation as out-of-scope for v1 (YAGNI — remove the task, just insert all clicks), or implement IP-based dedup within a time window (more effective). Do not add fake security that creates a false sense of protection.

---

## Finding 9: Phase 15 Retry Logic for Short Code Collision Is Client-Side Loop Anti-Pattern

- **Severity:** Medium
- **Location:** Phase 03, TASK-15
- **Flaw:** The plan proposes a `generateUniqueShortCode(supabase)` helper that retries insert up to 5 times on unique violation. This is a client-side read-then-write retry loop across a network boundary. Each retry is a round-trip to Supabase. The plan acknowledges "hoặc đơn giản hơn: generate server-side trong Supabase function/trigger (khuyến nghị)" but lists the client-side approach first and marks the server-side as a recommendation, not the implementation target.
- **Failure scenario:** Under concurrent creation (two users hitting create simultaneously), both clients generate the same short code, both pass the local uniqueness check, both attempt insert — one fails. The retry loop then runs: 5 more inserts, each with a round trip. If the database is under load, this is 5 wasted sequential network requests from the client. On mobile with poor connectivity, each retry adds 500ms+.
- **Evidence:** `"thử insert, nếu bị unique violation thì retry tối đa 5 lần với code mới"` — client-side, sequential, network-bound.
- **Suggested fix:** Use the server-side trigger/function approach exclusively. A Postgres function with `LOOP ... EXIT WHEN` generates a unique code atomically in a single DB call. Remove the client-side retry from scope.

---

## Finding 10: 54 Tasks Across 9 Phases with No Estimate or Cut Line

- **Severity:** Medium
- **Location:** plan.md, Phase Overview table
- **Flaw:** The plan has 54 tasks with no time estimates, no team size assumption, and no MVP cut line. The plan labels 3 phases Critical, 4 High, 2 Medium — but all 54 tasks are in scope simultaneously. There is no definition of "minimum shippable" that allows launching before Phase 07 tests and Phase 09 bypass feature are complete. A 54-task plan with no cut criteria is a waterfall plan masquerading as agile.
- **Failure scenario:** Development begins, Phases 01–05 are complete (34 tasks), but Phase 06 UI polish and Phase 09 bypass feature stall due to unplanned complexity. The app cannot ship because the plan provides no guidance on what can be deferred. The team has a fully-functional link shortener with auth and geo-routing sitting unreleased waiting for a "bypass badge" and "light/dark toggle".
- **Evidence:** No "MVP subset" section in plan.md. No "defer to v2" bucket. TASK-44 "Custom domain setup" is literally marked `(optional)` inline but is the only task with that label.
- **Suggested fix:** Define a P0 (must ship) vs P1 (nice to have) split in plan.md. Minimum viable: Phases 01, 02, 05, 08 (deployment). Everything else is post-launch.

---

*Unresolved questions: None — findings are based on plan content as written.*
