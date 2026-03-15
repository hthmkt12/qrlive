# Code Review — QRLive

**Date:** 2026-03-16
**Reviewer:** code-reviewer agent
**Scope:** Full `src/` + `supabase/` review

---

## Scope

- Files reviewed: 12 core files + 3 migration SQLs
- Focus: security, bugs, performance, TypeScript, React patterns, dead code
- Scout edge cases: covered inline (no prior git history, full-codebase review)

---

## Overall Assessment

The codebase is lean, well-structured, and easy to follow. Architectural decisions (TanStack Query, Zod validation, RLS migrations) are sound. However, there are two security issues that need attention before production use — one high (hardcoded credentials in source), one medium (open `click_events` INSERT policy). Performance has a notable background-polling concern. Type safety is mostly good with one unsafe cast. Dead code is minimal.

---

## Critical Issues

### C1 — Hardcoded Supabase anon key and project URL committed to source

**File:** `src/integrations/supabase/client.ts` lines 5–6

```ts
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "https://ybxmpuirarncxmenprzf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
```

The anon/publishable key and project URL are hardcoded as fallbacks. This means:
- The real project URL and key are permanently in git history, visible in any public repo fork
- Anyone who clones the repo can directly query the real Supabase project with the anon role
- Combined with the open `click_events` INSERT policy (see S1 below), this enables spam/data abuse

**Fix:** Remove the fallback literals entirely. Require env vars to be set. Fail fast if missing:
```ts
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error("Missing Supabase env vars — set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY");
}
```

Rotate the key in Supabase dashboard immediately, even if it is an anon key.

---

## High Priority

### H1 — `click_events` INSERT policy is fully open — abuse / spam writes possible

**File:** `supabase/migrations/20260315231019_auth_user_id_and_rls.sql` line 80–81

```sql
CREATE POLICY "click_events_insert_public" ON public.click_events
  FOR INSERT WITH CHECK (true);
```

The anon key (now leaked, see C1) combined with this policy means anyone can insert unlimited fake click events directly via the REST API, poisoning analytics. The edge function already uses the service role key to bypass RLS — the public INSERT policy is not needed for that path.

**Fix:** Remove the public INSERT policy. The edge function uses `SUPABASE_SERVICE_ROLE_KEY` which bypasses RLS entirely, so no client-side insert path needs this policy.

```sql
DROP POLICY "click_events_insert_public" ON public.click_events;
```

Add a corresponding migration file.

---

### H2 — Non-atomic geo routes update — data loss window on partial failure

**File:** `src/lib/db.ts` lines 106–124, `src/components/EditLinkDialog.tsx` lines 66–75

`updateGeoRoutesInDB` deletes all existing routes first, then inserts. If the insert fails, the link loses all its geo routes silently. Additionally, `EditLinkDialog.onSubmit` calls `updateLink` and `updateGeoRoutes` as two sequential awaits — if the second fails, the name/URL was already updated but routes are gone.

No database transaction wraps these operations client-side (not possible via JS client). Options:
- Use a Supabase Edge Function to execute both operations atomically in a single DB transaction
- Or at minimum: wrap the delete+insert in a single RPC call using a PL/pgSQL function that runs inside a transaction
- Short-term: restore the old routes on error in the catch block (fetch before delete, re-insert on failure)

---

### H3 — Unsafe type cast in `fetchLinks`

**File:** `src/lib/db.ts` line 42

```ts
return (data as QRLinkRow[]) || [];
```

The Supabase client returns a generated `Database` type for this query, which does not match `QRLinkRow` structurally (the generated type for nested relations differs). The `as` cast suppresses all type errors — a schema change would silently break at runtime without TS catching it.

**Fix:** Define a proper select return type using Supabase's generated types or use `satisfies` with an explicit shape check. At minimum, replace the cast with a typed guard.

---

### H4 — `user!.id` non-null assertion in CreateLinkDialog

**File:** `src/components/CreateLinkDialog.tsx` line 53

```ts
userId: user!.id,
```

`user` can theoretically be `null` if `AuthProvider` has a race during session resolution. The `!` assertion would throw a runtime exception rather than fail gracefully.

**Fix:** Guard before submit:
```ts
if (!user) return;
```

---

## Medium Priority

### M1 — Background polling every 10 seconds — unnecessary load

**File:** `src/hooks/use-links.ts` line 10

```ts
refetchInterval: 10_000,
```

Every tab polls the database every 10 seconds regardless of user activity. With multiple tabs open or many users, this creates constant load. The use case (analytics) does not require real-time data; a manual refresh or Supabase Realtime subscription would be more efficient.

**Recommendation:** Remove `refetchInterval`, add a manual "Làm mới" button, or use `refetchOnWindowFocus: true` (TanStack default) only.

---

### M2 — `selectedLink` stale-state edge case in Index.tsx

**File:** `src/pages/Index.tsx` lines 33–42

```ts
if (selectedLink) {
  const freshLink = links.find((l) => l.id === selectedLink.id);
  if (freshLink) {
    return <StatsPanel link={freshLink} ... />;
  }
}
```

If the selected link is deleted by another session (or via the background poll), `freshLink` will be `undefined` and the stats panel silently closes without notifying the user. The user loses their view without explanation.

**Fix:** When `freshLink` is undefined but `selectedLink` is set, show a toast and reset `selectedLink(null)` explicitly.

---

### M3 — `generateShortCode` has a race condition

**File:** `src/lib/db.ts` lines 46–57

The check-then-insert pattern for short code uniqueness is a TOCTOU race: two concurrent creates could both see no collision for code `XYZ`, then both attempt to insert — one will fail with a unique constraint violation that is not caught here (the outer `if (error || !link)` would catch it, but the user gets a generic "Failed to create link" error).

The current retry loop mitigates probabilistic collisions but not true concurrent races.

**Fix:** Rely on the database unique constraint as the source of truth. Catch the constraint violation specifically and retry with a new code, rather than pre-checking.

---

### M4 — `updated_at` column not updated in `updateGeoRoutesInDB`

**File:** `src/lib/db.ts` lines 102–125

Deleting and re-inserting geo routes does not touch `qr_links.updated_at`. The trigger only fires on `UPDATE` of `qr_links`. A user who edits only geo routes will see a stale `updated_at` timestamp.

**Fix:** After the geo routes insert, run:
```ts
await supabase.from("qr_links").update({ updated_at: new Date().toISOString() }).eq("id", linkId);
```

---

### M5 — Open redirect — `targetUrl` not validated server-side before redirect

**File:** `supabase/functions/redirect/index.ts` line 91

```ts
Location: targetUrl,
```

The `targetUrl` comes from `link.default_url` or `geoRoute.target_url`/`bypass_url` stored in the DB. These are validated by Zod on the client when creating/editing, but the edge function performs no validation. If the DB is ever written to directly (service role, SQL console, migration), a `javascript:` or `data:` URL could be stored and served as a redirect target.

**Fix:** Add server-side validation in the edge function before issuing the redirect:
```ts
const isValidUrl = (u: string) => /^https?:\/\//i.test(u);
if (!isValidUrl(targetUrl)) {
  return new Response(JSON.stringify({ error: "Invalid redirect target" }), { status: 400, ... });
}
```

---

### M6 — `geo_routes` keyed by `country_code` but a link can have duplicate country codes

**File:** `src/components/LinkCard.tsx` line 138, `src/components/StatsPanel.tsx` line 82

Both use `key={r.country_code}` for React list rendering. If the same country code appears twice (possible since there is no unique constraint on `(link_id, country_code)` in the DB), React will warn about duplicate keys and render incorrectly.

**Fix:** Key by `r.id` (already present on `GeoRouteRow`). Add a unique constraint on `(link_id, country_code)` in a new migration.

---

### M7 — `click_events` INSERT in edge function not awaited on error path

**File:** `supabase/functions/redirect/index.ts` lines 63–72

```ts
await supabase.from("click_events").insert({ ... });
```

If the insert fails (e.g., DB error), the error is silently swallowed — the function continues to redirect. While this is intentional (don't block redirect on analytics failure), the error is not logged. Silent failures make debugging difficult.

**Fix:** Log the error without blocking:
```ts
const { error: insertError } = await supabase.from("click_events").insert({ ... });
if (insertError) console.warn("click_events insert failed:", insertError.message);
```

---

## Low Priority

### L1 — `index` used as array key in chart renders

**File:** `src/components/StatsPanel.tsx` lines 143, 151, 165

Multiple places use array index as React key (`key={i}`). These are static lists derived from non-reordering data (sorted aggregations), so this is low risk but deviates from best practice.

---

### L2 — `QRPreview` component exists but `StatsPanel` passes `link.default_url` not the redirect URL

**File:** `src/components/StatsPanel.tsx` line 71

```ts
<QRPreview url={link.default_url} shortCode={link.short_code} name={link.name} />
```

The QR in StatsPanel encodes the `default_url` directly rather than the redirect wrapper URL. This is inconsistent with `LinkCard` which shows the wrapper URL. Users scanning from StatsPanel bypass the redirect/analytics system.

---

### L3 — Password strength not enforced beyond minimum length

**File:** `src/lib/schemas.ts` line 21

```ts
password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự"),
```

Only minimum length is validated. Supabase Auth enforces its own strength requirements server-side, but the client schema accepts `password` (8 chars) as valid. The server error will surface but client feedback is absent.

---

### L4 — `COUNTRIES` list is small and hardcoded (15 countries)

**File:** `src/lib/types.ts`

Only 15 countries are supported. Any visitor from an unlisted country with a geo route configured will fail the `COUNTRIES.find()` lookup and display an empty flag. Functionality is unaffected (the DB stores full codes), but the UI silently shows nothing for unlisted countries.

---

## Positive Observations

- RLS policies in migration `20260315231019` correctly scope all data to `auth.uid()` — owner-only access is well implemented
- Optimistic update in `useToggleActive` with correct rollback on error is a good pattern
- Short code validation regex `^[A-Z0-9]{6}$` in the edge function prevents path traversal/injection
- Zod schemas centralized in `schemas.ts` — shared between create and edit forms, no duplication
- Bot filtering in the edge function prevents analytics pollution from crawlers
- `AuthProvider` handles `getSession` failure gracefully (falls through to logged-out state)
- `Cache-Control: no-store` on redirects ensures click tracking accuracy
- `useInvalidateLinks` helper avoids repeating `invalidateQueries` in every mutation

---

## Top 5 Priority Fixes

| # | Issue | Severity | File |
|---|-------|----------|------|
| 1 | Remove hardcoded Supabase URL + anon key; rotate key | Critical | `src/integrations/supabase/client.ts` |
| 2 | Drop open `click_events` INSERT policy | High | migration SQL |
| 3 | Fix non-atomic geo routes update (delete+insert race) | High | `src/lib/db.ts`, `EditLinkDialog.tsx` |
| 4 | Add server-side URL validation before redirect | Medium | `supabase/functions/redirect/index.ts` |
| 5 | Key geo route list items by `r.id`, add DB unique constraint | Medium | `LinkCard.tsx`, `StatsPanel.tsx`, new migration |

---

## Metrics

- TypeScript `any` usages: 0 explicit (one unsafe `as` cast, H3)
- Unsafe non-null assertions: 1 (`user!.id`, H4)
- Missing error handling: 2 (silent analytics failure L, partial edit rollback H2)
- Linting issues: not run (no linter config found in scope of review)
- Test coverage: 1 placeholder test file (`src/test/example.test.ts`) — no meaningful tests

---

## Unresolved Questions

1. Is the Supabase project URL/key already public (e.g., deployed to a public repo)? If so, key rotation is urgent.
2. Is Supabase Realtime available on the plan? If yes, replacing polling with a subscription is a straightforward improvement.
3. Is there a plan to support more than 15 countries? The hardcoded list will cause silent UI gaps at scale.
4. Are geo routes expected to be unique per country per link? If yes, a DB constraint should be added to enforce it.
