# QRLive — Production Ready Plan

**Date:** 2026-03-15 | **Status:** Ready to implement

## App Summary
QRLive là dynamic QR code + link shortener với geo-routing và click analytics. UI tiếng Việt. Stack: React 18 + TypeScript + Vite + shadcn/ui + Supabase (Postgres + Edge Functions).

---

## Phase Overview

| # | Phase | Priority | Tasks | Status |
|---|-------|----------|-------|--------|
| 1 | [Cleanup & Config](./phase-01-cleanup-and-config.md) | 🔴 Critical | 01–04 | Todo |
| 2 | [Auth & Security](./phase-02-auth-and-security.md) | 🔴 Critical | 05–11 | Todo |
| 3 | [Form Validation](./phase-03-form-validation.md) | 🟠 High | 12–16 | Todo |
| 4 | [React Query Migration](./phase-04-react-query-migration.md) | 🟠 High | 17–21 | Todo |
| 5 | [Edge Function Hardening](./phase-05-edge-function-hardening.md) | 🟠 High | 22–26 | Todo |
| 6 | [UI/UX Polish](./phase-06-ui-ux-polish.md) | 🟡 Medium | 27–33 | Todo |
| 7 | [Testing](./phase-07-testing.md) | 🟡 Medium | 34–39 | Todo |
| 8 | [Deployment](./phase-08-deployment.md) | 🔴 Critical | 40–46 | Todo |
| 9 | [Bypass URL Feature](./phase-09-bypass-url-feature.md) | 🟠 High | 47–54 | Todo |

**Total: 54 tasks**

---

## All Tasks (Quick Reference)

### Phase 01 — Cleanup & Config
- **TASK-01** Xóa dead code: `store.ts`, `NavLink.tsx`, interfaces cũ trong `types.ts`
- **TASK-02** Fix hardcoded Supabase URL trong `db.ts` → dùng `import.meta.env.VITE_SUPABASE_URL`
- **TASK-03** Tạo `.env.example`
- **TASK-04** Xóa unused deps: vaul, cmdk, embla-carousel, react-resizable-panels, input-otp, date-fns

### Phase 02 — Auth & Security
- **TASK-05** Supabase Auth setup + migration: thêm `user_id` vào `qr_links`
- **TASK-06** Update RLS policies — owner-only access cho qr_links/geo_routes, public insert cho click_events
- **TASK-07** Tạo `src/contexts/auth-context.tsx` — AuthContext + AuthProvider
- **TASK-08** Tạo `src/pages/Auth.tsx` — login/signup form với react-hook-form + zod
- **TASK-09** ProtectedRoute trong `App.tsx` — redirect `/auth` nếu chưa login
- **TASK-10** Update `db.ts` — pass `user_id` khi create link
- **TASK-11** Header: hiển thị email user + nút đăng xuất

### Phase 03 — Form Validation
- **TASK-12** Tạo `src/lib/schemas.ts` — zod schemas cho link, geo route, auth
- **TASK-13** Refactor `CreateLinkDialog` — dùng react-hook-form + zod
- **TASK-14** Refactor `EditLinkDialog` — dùng react-hook-form + zod
- **TASK-15** Fix short code collision trong `db.ts` — retry logic
- **TASK-16** Validate `shortCode` format trong edge function

### Phase 04 — React Query Migration
- **TASK-17** Tạo `src/lib/query-keys.ts`
- **TASK-18** Tạo `src/hooks/use-links.ts` — useQuery với refetchInterval
- **TASK-19** Tạo `src/hooks/use-link-mutations.ts` — create/update/delete/toggle mutations
- **TASK-20** Refactor `Index.tsx` — xóa manual setInterval, dùng hooks
- **TASK-21** Refactor dialogs — nhận mutation functions qua props

### Phase 05 — Edge Function Hardening
- **TASK-22** Xóa `ip-api.com` fallback — dùng Cloudflare `cf-ipcountry` header only
- **TASK-23** Handle link inactive/not-found → 404
- **TASK-24** Thêm `Cache-Control: no-store` response header
- **TASK-25** Skip click insert cho bot user agents
- **TASK-26** Dùng service role key trong edge function để bypass RLS

### Phase 06 — UI/UX Polish
- **TASK-27** Loading skeletons (shadcn Skeleton) cho link cards
- **TASK-28** Empty state khi chưa có QR link nào
- **TASK-29** Mobile layout responsive (375px+)
- **TASK-30** "← Quay lại" button trong StatsPanel
- **TASK-31** AlertDialog confirm trước khi xóa link
- **TASK-32** Copy link toast feedback + icon animation
- **TASK-33** Light/Dark theme toggle (wire up next-themes)

### Phase 07 — Testing
- **TASK-34** Unit tests `src/test/db.test.ts`
- **TASK-35** Unit tests `src/test/schemas.test.ts`
- **TASK-36** Component test `src/test/link-card.test.tsx`
- **TASK-37** Component test `src/test/create-link-dialog.test.tsx`
- **TASK-38** E2E test `src/test/e2e/create-and-redirect.spec.ts`
- **TASK-39** Xóa placeholder test `example.test.ts`

### Phase 08 — Deployment
- **TASK-40** Setup `.env.local`, verify local dev
- **TASK-41** `supabase db push` — deploy migrations
- **TASK-42** `supabase functions deploy redirect`
- **TASK-43** Deploy frontend lên Vercel + set env vars
- **TASK-44** Custom domain setup (optional)
- **TASK-45** Tạo `vercel.json` — SPA rewrites
- **TASK-46** Add `typecheck` script vào `package.json`

### Phase 09 — Bypass URL Feature
- **TASK-47** Migration: thêm `bypass_url TEXT` vào `geo_routes`
- **TASK-48** Re-generate Supabase TypeScript types
- **TASK-49** Edge Function: ưu tiên `bypass_url` → `target_url` → `default_url`
- **TASK-50** `db.ts`: thêm `bypass_url` vào `GeoRouteRow` + INSERT payload
- **TASK-51** `CreateLinkDialog`: collapsible "Bypass URL" field mỗi geo route
- **TASK-52** `EditLinkDialog`: pre-populate `bypass_url` từ existing data
- **TASK-53** `LinkCard`: badge "bypass" nhỏ khi route có bypass_url
- **TASK-54** `schemas.ts`: thêm `bypass_url` optional URL validation

---

## Recommended Execution Order

```
Phase 01 → Phase 02 → Phase 08 (TASK-40–42) → Phase 03 → Phase 04 → Phase 05 → Phase 09 → Phase 06 → Phase 07 → Phase 08 (TASK-43–46)
```

Phase 01 + 02 + deploy Supabase trước để có auth foundation. Sau đó implement features. Test cuối cùng trước deploy frontend.

---

## Red Team Review

### Session — 2026-03-16
**Findings:** 15 (13 accepted, 2 rejected)
**Severity breakdown:** 5 Critical, 6 High, 4 Medium (2 rejected were Medium)

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | `geo_routes` RLS undefined — no SQL written | Critical | Accept | Phase 02, TASK-06 |
| 2 | `bypass_url` open redirect — phishing/SSRF | Critical | Accept | Phase 09, TASK-49 |
| 3 | Existing rows orphaned after `user_id` migration | Critical | Accept | Phase 02, TASK-05 |
| 4 | Service role + public INSERT contradiction | Critical | Accept | Phase 02, TASK-06 + Phase 05, TASK-26 |
| 5 | Phase 09 is pre-MVP scope creep | Critical | Accept | Phase 09 header + plan.md MVP table |
| 6 | Short code TOCTOU — client-side retry mandated out | High | Accept | Phase 03, TASK-15 |
| 7 | E2E tests against production — no test env | High | Accept | Phase 07, TASK-38 |
| 8 | Phase 08 split deploy — no backup/rollback path | High | Accept | Phase 08, TASK-41 |
| 9 | Optimistic toggle — no `onError` rollback | High | Accept | Phase 04, TASK-19 |
| 10 | `cf-ipcountry` spoofable via direct Supabase URL | High | Accept | Phase 05, TASK-22 |
| 11 | No rate limiting on public redirect endpoint | High | Accept | Phase 05, TASK-25.5 (new) |
| 12 | `bypass_url ?? target_url` bug (nullish vs falsy) | Medium | Accept | Phase 09, TASK-49 |
| 13 | 54 tasks with no MVP cut line | Medium | Accept | plan.md MVP table |
| 14 | No email confirmation enforced | Medium | Reject | Supabase dashboard config, not plan scope |
| 15 | Supabase URL in plan committed to repo | Medium | Reject | Pre-existing, not plan-specific |

---

## MVP Cut Line (Red Team Addition)

> ⚠️ **[RED TEAM #13 — Medium]** 54 tasks with no P0 subset defined. Implementers have no guidance on what's required to ship vs. what's deferrable.

| Tier | Phases | Required to ship? |
|------|--------|-------------------|
| **P0 (Must ship)** | 01, 02, 05, 08 | Yes — Cleanup, Auth/RLS, Edge hardening, Deploy |
| **P1 (Should ship)** | 03, 04 | Yes — Form validation, React Query |
| **P2 (Can defer)** | 06, 07, 09 | No — UI Polish, Testing, Bypass URL |

Phase 09 specifically recommended for deferral (see Red Team #5 in phase-09).

---

## Key Files
- Entry: `src/main.tsx`, `src/App.tsx`
- Pages: `src/pages/Index.tsx`
- Data layer: `src/lib/db.ts`
- Supabase client: `src/integrations/supabase/client.ts`
- Edge function: `supabase/functions/redirect/index.ts`
- Schema: `supabase/migrations/`
