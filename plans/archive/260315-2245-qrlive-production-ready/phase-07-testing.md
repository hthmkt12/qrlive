# Phase 07 — Testing

**Priority:** 🟡 Medium | **Status:** Todo

## Overview
Hiện chỉ có 1 placeholder test `expect(true).toBe(true)`. Cần coverage cho business logic và critical paths.

## Tasks

### TASK-34: Unit tests cho db.ts helpers
File: `src/test/db.test.ts`
- [ ] Mock Supabase client
- [ ] Test `fetchLinks()` — trả đúng shape
- [ ] Test `createLinkInDB()` — gọi insert với đúng payload
- [ ] Test `deleteLinkInDB()` — gọi delete đúng id
- [ ] Test `getRedirectUrl()` — URL format đúng với env var

### TASK-35: Unit tests cho Zod schemas
File: `src/test/schemas.test.ts`
- [ ] Test `createLinkSchema` — valid case, invalid URL, empty name
- [ ] Test `geoRouteSchema` — invalid country_code length, invalid URL
- [ ] Test `authSchema` — email format, password min length

### TASK-36: Component test — LinkCard
File: `src/test/link-card.test.tsx`
- [ ] Render với mock link data
- [ ] Click "Xóa" → confirm dialog xuất hiện
- [ ] Click toggle active → gọi mutation

### TASK-37: Component test — CreateLinkDialog
File: `src/test/create-link-dialog.test.tsx`
- [ ] Submit với URL không hợp lệ → hiển thị error message, không gọi API
- [ ] Submit valid form → gọi `createLink` mutation
- [ ] Loading state → button disabled

### TASK-38: E2E test — happy path (Playwright)
File: `src/test/e2e/create-and-redirect.spec.ts`
<!-- Updated: Validation Session 1 - Local Supabase confirmed for E2E environment -->
**E2E Environment: Local Supabase via `supabase start` (Docker required)**

**Prerequisites:**
```bash
supabase start  # starts local Postgres + edge functions + auth
# Set in .env.test:
# PLAYWRIGHT_TEST_BASE_URL=http://localhost:5173
# VITE_SUPABASE_URL=http://localhost:54321
# VITE_SUPABASE_ANON_KEY=<local-anon-key from supabase start output>
# PLAYWRIGHT_TEST_EMAIL=test@example.com
# PLAYWRIGHT_TEST_PASSWORD=testpassword123
```

> ~~⚠️ **[RED TEAM #7 — High]**~~ **[RESOLVED by Validation]** Local Supabase chosen — no production risk. "Login với test account" — no environment defined, no credentials source, no test isolation. Without a separate Supabase project for testing, this runs against production: creates real links, generates real analytics, cleanup failures leave permanent artifacts. **Fix:**
> - Use `supabase start` (local Supabase) for E2E, set `PLAYWRIGHT_TEST_BASE_URL=http://localhost:5173` and `VITE_SUPABASE_URL=http://localhost:54321` in `.env.test`
> - Store test credentials in `PLAYWRIGHT_TEST_EMAIL` / `PLAYWRIGHT_TEST_PASSWORD` env vars, documented in `.env.example`
> - Add `afterEach` cleanup that deletes all links created by the test user

- [ ] **Define test environment** — local Supabase instance (not production)
- [ ] **Document credentials** — `PLAYWRIGHT_TEST_EMAIL` + `PLAYWRIGHT_TEST_PASSWORD` in `.env.example`
- [ ] Login với test account
- [ ] Tạo QR link mới
- [ ] Verify card xuất hiện trong danh sách
- [ ] Click stats → StatsPanel hiển thị
- [ ] Xóa link → card biến mất
- [ ] `afterEach`: delete all links created during test (runs even on failure)

### TASK-39: Xóa placeholder test
File: `src/test/example.test.ts`
- [ ] Xóa file này

## Files Created
- `src/test/db.test.ts`
- `src/test/schemas.test.ts`
- `src/test/link-card.test.tsx`
- `src/test/create-link-dialog.test.tsx`
- `src/test/e2e/create-and-redirect.spec.ts`

## Files Deleted
- `src/test/example.test.ts`

## Success Criteria
- `bun test` pass 100%
- Coverage ≥ 70% trên `src/lib/` và `src/components/`
- E2E happy path pass trên Chromium
