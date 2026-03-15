# Plan Review: QRLive Production Ready — Assumption Destroyer Report

**Date:** 2026-03-16 | **Plan:** `plans/260315-2245-qrlive-production-ready/`

---

## Finding 1: geo_routes RLS Policy Is a Placeholder, Not an Implementation

- **Severity:** Critical
- **Location:** Phase 02, TASK-06 "Update RLS Policies"
- **Flaw:** The geo_routes RLS policy is described as "inherit qua link_id (join check)" with zero SQL provided. This is not a plan — it's a deferred decision. A join-based RLS policy requires `USING (EXISTS (SELECT 1 FROM qr_links WHERE qr_links.id = geo_routes.link_id AND qr_links.user_id = auth.uid()))`, which must also contend with the fact that deleting/updating geo_routes requires write policies, not just select. None of this is specified.
- **Failure scenario:** Implementer writes a partial or incorrect RLS policy. User A can read or mutate User B's geo_routes because the join condition was wrong, omitted for write operations, or the table has RLS enabled but no write policies (which silently blocks all writes). App breaks on geo route creation post-auth rollout.
- **Evidence:** "geo_routes: inherit qua link_id (join check)" — no SQL, no mention of INSERT/UPDATE/DELETE policies.
- **Suggested fix:** Write out the full four-policy SQL block for geo_routes (SELECT, INSERT, UPDATE, DELETE) with the join condition, same as done for qr_links.

---

## Finding 2: Service Role Key Exposure Risk in Edge Function

- **Severity:** Critical
- **Location:** Phase 05, TASK-26 "Supabase service role cho edge fn"
- **Flaw:** The plan instructs using `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS for click_events INSERT. The plan simultaneously defines `public_insert_clicks` as `WITH CHECK (true)` in Phase 02. These two mechanisms are redundant — but more dangerously, the plan gives no constraint on what the service role client can do. A service role client bypasses ALL RLS on ALL tables. If the edge function has any code path that uses this client to do anything other than click insert (e.g., reading link data for routing), it exposes the full database with zero access control.
- **Failure scenario:** Edge function uses service role client to both fetch link data (for routing) AND insert clicks. A code bug or future modification uses the service role client to execute an unintended write on qr_links, bypassing all owner-only policies. Alternatively, the anon key already suffices for click insert given the `public_insert_clicks` policy — service role is unnecessary and adds blast radius.
- **Evidence:** TASK-26 says "Đảm bảo click_events INSERT bypass RLS (service role bypass RLS)" while TASK-06 already defines `CREATE POLICY "public_insert_clicks" ON click_events FOR INSERT WITH CHECK (true)`.
- **Suggested fix:** Choose one mechanism. If public_insert_clicks policy exists, use anon key in edge function. Reserve service role only if the policy is removed. Document explicitly which tables the service role client is allowed to touch.

---

## Finding 3: TASK-15 Short Code Collision Retry Is Client-Side — Race Condition Guaranteed

- **Severity:** High
- **Location:** Phase 03, TASK-15 "Fix short code collision"
- **Flaw:** The plan proposes `generateUniqueShortCode(supabase)` that "tries insert, retries on unique violation up to 5 times." This is a client-side optimistic check-then-insert pattern. Between the uniqueness check and the insert, another concurrent request can claim the same code. The plan even acknowledges "Hoặc đơn giản hơn: generate server-side" but marks the client-side path as primary without resolving which approach is used.
- **Failure scenario:** Two users simultaneously create a link. Both generate code "ABC123". Both check — it doesn't exist yet. Both insert. One fails with a unique constraint violation. The retry loop generates another code, but the 5-retry limit may be hit under high concurrency. More likely: the retry logic's error handling is wrong and throws an unhandled exception.
- **Evidence:** "thử insert, nếu bị unique violation thì retry tối đa 5 lần với code mới — Hoặc đơn giản hơn: generate server-side... (khuyến nghị)" — two options listed, neither committed to.
- **Suggested fix:** Commit to the server-side approach (database trigger or Postgres function with `INSERT ... ON CONFLICT` retry loop). Remove the client-side option. The ambiguity will result in the implementer picking the easier-looking (wrong) path.

---

## Finding 4: Execution Order Puts Deployment Mid-Plan, Then Adds Phase 09 Schema Changes Afterward

- **Severity:** High
- **Location:** `plan.md`, "Recommended Execution Order"
- **Flaw:** The recommended order is `Phase 01 → 02 → 08 (TASK-40–42) → 03 → 04 → 05 → 09 → 06 → 07 → 08 (TASK-43–46)`. Phase 08 TASK-41 (`supabase db push`) deploys migrations to production mid-plan. Phase 09 then adds a new migration (`bypass_url` column). The plan assumes `supabase db push` can be run twice cleanly, with no discussion of migration ordering, idempotency, or the risk of running Phase 02 migration to production before Phase 09 migration exists — then having to deploy a second schema change while the app is live.
- **Failure scenario:** Phase 08 TASK-41 pushes auth migrations to production. App goes live. Phase 09 requires another `supabase db push`. During that window, the edge function queries `geo_routes` but `bypass_url` column doesn't exist — no failure yet. But if Phase 09 is delayed (blocked by UI work in Phase 06), production runs without bypass_url for an indefinite period. The column addition is not a zero-downtime concern in Postgres for a small app, but the plan provides zero rollback guidance if the second push fails.
- **Evidence:** Execution order splits Phase 08 into two halves with Phase 09 (schema change) in between, with no migration rollback plan.
- **Suggested fix:** Either batch all migrations before first `supabase db push`, or explicitly document the two-deployment sequence with rollback steps for each.

---

## Finding 5: E2E Test Requires Live Supabase Auth — No Test Environment Defined

- **Severity:** High
- **Location:** Phase 07, TASK-38 "E2E test — happy path"
- **Flaw:** The E2E test "Login với test account" against what? The plan specifies no test Supabase project, no seed data strategy, no test user credentials management, and no environment isolation. If it runs against the production Supabase project, E2E tests create real data. If it runs against local Supabase, the plan never mentions `supabase start` as a prerequisite, nor the local service URL differences.
- **Failure scenario:** CI runs the E2E test. It hits the production Supabase URL (from `.env`). The test creates QR links in production, then deletes them. Alternatively, it fails because the test user doesn't exist in production, and the plan provides no mechanism to create/seed it. Test passes locally but fails in CI because no env vars are configured for CI.
- **Evidence:** TASK-38 says "Login với test account" with no specification of what "test account" means, where it lives, or how it's provisioned.
- **Suggested fix:** Define a local Supabase environment for E2E tests. Add `supabase start` to CI setup. Create a seed script for test users. Separate test env vars from production env vars.

---

## Finding 6: cf-ipcountry Header Is Trusted Input Without Validation

- **Severity:** High
- **Location:** Phase 05, TASK-22 "Replace ip-api.com với Cloudflare header"
- **Flaw:** The plan says "cf-ipcountry header đã được parse — ưu tiên dùng cái này" and removes the fallback. But `cf-ipcountry` is only trustworthy when requests come through Cloudflare's network. Supabase Edge Functions run on Deno Deploy, not necessarily behind Cloudflare for every invocation path. If a direct request bypasses Cloudflare (e.g., direct Supabase URL, certain integrations, or future infrastructure changes), the header can be spoofed by any client setting `cf-ipcountry: VN`. The plan explicitly removes ALL fallback to ip-api.com.
- **Failure scenario:** An attacker directly calls `https://<project>.supabase.co/functions/v1/redirect/<code>` with header `cf-ipcountry: VN`. They are routed to the bypass_url intended for Vietnamese users (Phase 09 feature), exposing the bypass routing logic to trivial geographic spoofing.
- **Evidence:** "Xóa fallback gọi ip-api.com — gây latency + unreliable" with no mention of verifying the request actually came through Cloudflare.
- **Suggested fix:** Document the threat model. If bypass_url contains sensitive mirror links, geographic spoofing is a real concern. At minimum, validate that `cf-ray` header is also present (harder to fake), or accept that geo-routing is advisory-only (not a security control) and document that explicitly.

---

## Finding 7: TASK-04 Removes Dependencies Before Confirming They Are Actually Unused

- **Severity:** High
- **Location:** Phase 01, TASK-04 "Xóa unused dependencies"
- **Flaw:** The plan lists specific packages to remove (`vaul`, `cmdk`, `embla-carousel`, `react-resizable-panels`, `input-otp`, `date-fns`) but shadcn/ui components often auto-import peer components and these packages may be transitive dependencies of shadcn primitives that ARE in use. `cmdk` is used by shadcn's Command component. `date-fns` may be used by shadcn's Calendar or DatePicker. Removing them will cause runtime errors for any shadcn component that depends on them, even if the component isn't directly imported in the developer's code.
- **Failure scenario:** Developer runs `bun remove cmdk`. Build passes (tree-shaking removes unused code paths). Later in Phase 06, a shadcn component that internally depends on cmdk is added. Import fails at runtime or build time. Alternatively, a currently-used shadcn component already depends on one of these packages and removal breaks the build immediately — but success criteria only checks "build passes" not runtime.
- **Evidence:** "Giữ lại next-themes, react-hook-form, zod, @tanstack/react-query (sẽ dùng ở phase sau)" — no mention of auditing what existing shadcn components transitively require.
- **Suggested fix:** Before removing, run `bunx depcheck` or manually verify each package's consumers including shadcn component internals. Add a step to confirm no shadcn component imports the removed packages.

---

## Finding 8: Optimistic Toggle in useToggleActive Has No Rollback Path Defined

- **Severity:** Medium
- **Location:** Phase 04, TASK-19 "useLinkMutations hook"
- **Flaw:** The plan calls for "optimistic update: flip is_active locally trước khi server confirm" with no specification of the rollback behavior when the server request fails. React Query's optimistic update pattern requires explicit `onError` context restore logic (`context.previousLinks`) or the UI will show the wrong state permanently until the next background refetch.
- **Failure scenario:** User toggles a link inactive. Client immediately shows it as inactive. Server request fails (network error, RLS violation, etc.). Without `onError` rollback in the mutation, the UI shows "inactive" while the DB has "active." The next background refetch (10 seconds) will correct it, but the user sees incorrect state and may make decisions based on it (e.g., thinking the link is already deactivated).
- **Evidence:** "useToggleActive() — optimistic update: flip is_active locally trước khi server confirm (optional)" — marked optional, no rollback path mentioned.
- **Suggested fix:** Either commit to full optimistic update with explicit `onMutate`/`onError`/`onSettled` handlers, or use `invalidateQueries` only (pessimistic) and rely on the 10-second refetch. Do not leave it as "optional" without defining the error path.

---

## Finding 9: Phase 08 TASK-40 Leaks the Real Project URL in Plaintext

- **Severity:** Medium
- **Location:** Phase 08, TASK-40 "Environment variables"
- **Flaw:** TASK-40 shows the actual Supabase project URL (`https://mapcpkxjmxltvgkgrurz.supabase.co`) in the plan document itself. This plan is committed to the repository. The project reference `mapcpkxjmxltvgkgrurz` is a persistent identifier for the Supabase project — anyone with repo access can use it to probe the public API endpoints, discover exposed edge functions, and attempt unauthenticated access to any tables without RLS enabled (which exists until Phase 02 is deployed).
- **Failure scenario:** Repository is public (or becomes public). The project URL in the plan file allows enumeration of Supabase endpoints. Before Phase 02 RLS policies are applied, the production database is fully readable and writable to anyone.
- **Evidence:** "VITE_SUPABASE_URL=https://mapcpkxjmxltvgkgrurz.supabase.co" hardcoded in phase-08-deployment.md.
- **Suggested fix:** Replace with `<your-project-ref>.supabase.co` placeholder. The actual URL belongs only in `.env.local` (gitignored). Also cross-reference with TASK-02 which fixes the same URL in db.ts — the plan itself contains the leak it's trying to fix.

---

## Finding 10: Testing Phase Comes After Phase 09 Feature — Tests Will Miss the Bypass URL Logic

- **Severity:** Medium
- **Location:** `plan.md`, Execution Order + Phase 07 scope
- **Flaw:** The recommended execution order places Phase 09 (bypass_url feature) before Phase 07 (testing). However, Phase 07's test tasks (TASK-34 to TASK-38) were written before Phase 09 was scoped and contain zero test coverage for bypass_url routing logic — the most complex and security-sensitive new code path in the entire plan. The E2E test covers create/redirect but not the bypass_url routing branch.
- **Failure scenario:** Phase 09 is implemented. Phase 07 tests are written based on the pre-Phase-09 task descriptions. Bypass URL routing is deployed to production with zero test coverage. A bug where `bypass_url` takes priority even when it shouldn't (e.g., empty string vs null check in `??` operator) goes undetected. Users in non-targeted countries get redirected to bypass URLs.
- **Evidence:** Phase 07 task list has no mention of bypass_url. TASK-49 uses `matchedRoute?.bypass_url ?? matchedRoute?.target_url ?? link.default_url` — the `??` nullish coalescing will NOT skip an empty string `bypass_url`, only null/undefined.
- **Suggested fix:** Add explicit test tasks for bypass_url edge cases to Phase 07: empty string bypass_url (should fall through to target_url), null bypass_url, valid bypass_url. Fix the nullish coalescing logic to use `|| ` or trim-check before `??`.

---

## Unresolved Questions

1. Is the Supabase project shared across dev/staging/production, or are there separate projects? The plan assumes single-project deployment with no environment isolation.
2. Who manages the test account credentials for TASK-38 in CI? No secrets management strategy is mentioned.
3. Does `supabase functions deploy redirect --no-verify-jwt` mean the redirect function is callable without any JWT? If so, what prevents unrestricted click event spam to inflate analytics?
4. The plan mentions `click_events` public insert is needed for the edge function — but with service role in TASK-26, why is the public policy in TASK-06 also defined? One will be redundant and could create confusion about the actual access model.
