# Project Changelog

**QRLive** — Dynamic QR Code Link Shortener

All significant changes, features, and fixes documented here.

---

## [Unreleased]

### Added
- OpenAPI 3.1 spec in `docs/openapi.yaml` covering redirect endpoints, Worker gateway paths, fallback proxy, proxy-gateway health, and the `click.created` webhook payload
- Real referer breakdown per country via `get_link_click_detail_v3`, wired through analytics query cache keys and StatsPanel country filtering
- Optional Redis caching for hot public links in the redirect edge function, plus authenticated cache invalidation after dashboard link edits, toggles, geo-route changes, and deletes

### Fixed
- Hardened click webhooks by rejecting localhost, IP-literal, and non-public hostnames before the redirect edge function issues outbound fetches
- Completed Redis cache invalidation preflight headers so browser-triggered purge requests do not silently fail on CORS
- Closed the remaining CSV formula-injection gap for values prefixed by spaces or line breaks, and made bulk CSV parsing count quoted multiline rows correctly
- Clarified analytics country filtering so the selector scopes referer breakdown/export metadata without mixing filtered and global dashboard totals

### Improved
- Added first-class `npm run test:coverage` support in repo scripts and expanded Vitest coverage to include redirect/cache helpers plus the Cloudflare Worker
- Added regression tests for browser-side Redis cache invalidation and analytics export actions, lifting visibility into cache/webhook/analytics V2 quality after recent feature work

### Planned Features
- User guide

---

## [2026-03-17-v1.7] — Click Webhook Integrations

### Added
- **Per-link webhook configuration**
  - Added nullable `webhook_url` on `qr_links` via migration `20260317113000_add_webhook_url_to_qr_links.sql`
  - Wired webhook URL through link create/edit validation, mutations, and dashboard queries
  - Added Vietnamese form copy describing that notifications fire only for recorded clicks

- **Redirect webhook delivery**
  - Added `click.created` JSON payload builder + delivery helper under `supabase/functions/redirect/`
  - Redirect handler now queues webhook POSTs only after a click is actually recorded
  - Webhook payload includes link identity, destination URL, geo-routing flag, country code, and referer

### Improved
- **Redirect performance safety**
  - Supabase edge wrapper now uses background tasks (`EdgeRuntime.waitUntil`) so redirects do not block on webhook responses
  - Invalid redirect targets are rejected before analytics/webhook side effects run

### Testing
- Added webhook helper tests plus redirect handler regressions for queueing, duplicate-click suppression, and failure isolation
- Validation status: `308/308` unit + integration tests passing, `30/30` Playwright passing, build/typecheck clean

---

## [2026-03-17-v1.6] — GitHub Actions PR CI

### Added
- **GitHub Actions workflow** (`.github/workflows/ci.yml`)
  - Triggers on pull requests plus manual `workflow_dispatch`
  - Cancels superseded PR runs via workflow concurrency

- **Quality checks on PR**
  - Runs `npm run lint`
  - Runs `npx tsc --noEmit`
  - Runs `npm test`
  - Runs `npm run build`

- **Credentialed Playwright E2E on PR**
  - Runs after quality checks pass
  - Uses repository secrets for `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `E2E_TEST_EMAIL`, and `E2E_TEST_PASSWORD`
  - Uploads `playwright-report/` and `test-results/` as artifacts for debugging

### Notes
- Full dashboard E2E remains secret-gated so fork PRs do not fail purely because repository secrets are unavailable.

---

## [2026-03-17-v1.5] — Cloudflare Worker Production Setup & E2E Audit

### Added
- **Cloudflare Worker rewrite** (`cloudflare-worker/redirect-proxy.js`)
  - Replaced hardcoded `SUPABASE_REDIRECT_URL` with `SUPABASE_URL` + `SUPABASE_ANON_KEY` secrets
  - POST body forwarding for password-protected link submissions
  - Geo-routing header preservation (`cf-ipcountry`, `user-agent`, `referer`)
  - Supabase auth header injection (`apikey`, `Authorization: Bearer`)
  - JSON error responses with fail-fast for missing secrets (500), unsupported methods (405)
  - Both `/CODE` and `/r/CODE` path styles supported

- **Worker tests** (19 tests in `cloudflare-worker/redirect-proxy.test.js`)
  - `extractShortCode`: 5 tests (path parsing, edge cases)
  - `buildUpstreamHeaders`: 4 tests (auth injection, header filtering)
  - Proxy forwarding contract: 6 tests (upstream URL, auth headers, geo routing, POST body, redirect:manual)
  - Error handling: 4 tests (missing secrets, empty code, CORS, unsupported methods)

- **Vitest `test.projects` integration**
  - Worker tests run as `cloudflare-worker` project (node env) alongside `app` project (jsdom)
  - Single `npm test` runs all 308 tests (289 app + 19 worker)
  - Removed deprecated `vitest.workspace.ts`

### Improved
- **E2E test audit**: reduced skips from 4 to 0 in `redirect.spec.ts`
  - Merged duplicate local-dev smoke tests
  - Final suite: 30 passed, 0 failed, 0 skipped

### Status Summary
- **Unit / integration tests**: 308/308 passing ✅ (289 app + 19 worker)
- **Playwright E2E**: 30 passed, 0 skipped
- **Build**: Clean
- **Typecheck**: 0 errors

---

## [2026-03-17-v1.4] — QR Persistence, Analytics Export, Sentry, Bulk Ops & Playwright

### Added
- **QR config persistence**
  - Added `qr_config` JSONB persistence path for QR colors, logo URL, border style, and error level
  - Wired QR config through link create/update mutations
  - Added SVG download path in `QRPreview`

- **Analytics enhancements**
  - Added StatsPanel country filter
  - Added quick range toggles (7/30/90 ngày + custom)
  - Added analytics CSV export
  - Added analytics PDF export via browser print flow

- **Error tracking**
  - Added `@sentry/react` initialization in `src/lib/sentry-config.ts`
  - Added app-level `Sentry.ErrorBoundary`
  - Enabled Browser Tracing + Replay sampling when `VITE_SENTRY_DSN` is present

- **Bulk operations**
  - Added dashboard CSV export for links
  - Added CSV import dialog with drag-drop upload
  - Added row validation, preview table, grouped import, and progress UI

- **Playwright E2E suite**
  - Added `playwright.config.ts` with Chromium-only project and auto-started dev server
  - Added feature specs for auth, link CRUD, QR customization, analytics, and bulk operations
  - Added shared Playwright helpers for credential lookup and dashboard flows

### Fixed
- Updated 7 existing tests for the new `qrConfig` parameter and QR persistence behavior
- Applied remote migrations for `has_password` and `qr_config` so the live Supabase schema matches the shipped app code
- Fixed `QRPreview` PNG export by avoiding the `Image` icon / `window.Image` constructor name collision
- Improved LinkCard action-button clickability for toggle/delete flows
- Tightened Playwright specs around dashboard auth gating, analytics filters, and QR action coverage

### Notes
- Credentialed dashboard E2E requires `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD` in `.env.local` or shell env
- Local seeded run verified the suite executes end-to-end with `qrlive.e2e@example.com`; auth-gated specs still skip cleanly when credentials are absent

### Status Summary
- **Unit / integration tests**: 289/289 passing ✅
- **Playwright**: 27 passed, 4 intentional skips in local Chromium run with seeded auth env
- **Build**: Clean
- **Typecheck**: 0 errors

---

## [2026-03-16-v3] — Redirect Handler Extraction & Direct Tests (289 tests)

### Added
- **Redirect Handler Extraction**
  - Extracted real edge logic from `supabase/functions/redirect/index.ts` into runtime-agnostic `redirect-handler.ts`
  - Introduced `SupabaseAdapter` interface for testability (fetchLink, recentClickCount, insertClick, updateLink)
  - `index.ts` is now a thin Deno wrapper delegating to the extracted handler

- **Direct Redirect Handler Tests** (13 tests in `redirect-handler.test.ts`)
  - OPTIONS preflight → 200 + CORS
  - Invalid short code → 400
  - Missing/inactive link → 404
  - Expired link → 410 HTML
  - Password-protected GET → 200 form, wrong POST → 401, correct POST → 302
  - Legacy SHA-256 opportunistic rehash path
  - Geo-routing priority (bypass → target → default)
  - Bot traffic skips click insert, non-bot records click
  - Duplicate click within 60s skipped
  - Non-http URL → 400

- **Route-Level Code Splitting**
  - Pages (Index, Auth, NotFound) lazy-loaded via `React.lazy()`
  - StatsCharts extracted and lazy-loaded from StatsPanel shell
  - DashboardHeader, DashboardMetrics extracted
  - Main chunk: 790KB → 490KB (−38%)

- **React Router v7 Future Flags**
  - Enabled `v7_startTransition` and `v7_relativeSplatPath` on all routers

- **Browserslist Data Refresh**
  - `npm update caniuse-lite` resolved outdated-data warning

### Status Summary
- **Tests**: 289/289 passing ✅
- **Test Files**: 20
- **Build**: Clean, no warnings (~5s)
- **Typecheck**: 0 errors

---

## [2026-03-16-v2] — Test Coverage Push to 93.34% (269 tests)

### Added
- **Comprehensive Test Expansion** (+70 tests, +35% growth)
  - db-mutations.test.ts: 40+ tests (mutations, error handling, validation)
  - use-links.test.ts: 25+ tests (query fetching, caching, pagination)
  - analytics-date-range-picker.test.tsx: 8 tests (component, state, callbacks)
  - query-keys.test.ts: 6 tests (key factory validation)
  - pages-auth.test.tsx: 15+ tests (auth page rendering, form validation)
  - pages-index.test.tsx: 10+ tests (dashboard, link list, analytics)
  - pages-not-found.test.tsx: 5+ tests (404 page, navigation)

### Improved
- **Test Coverage Metrics**
  - Statement coverage: 59% → 93.34% (+34.34%) ✅ EXCEEDED >80% target
  - Branch coverage: 69.19% → 77.02%
  - Function coverage: 67.08% → 83.15%

- **Testing Infrastructure**
  - Added @vitest/coverage-v8 provider
  - Added @testing-library/dom for DOM utilities
  - Configured scoped include/exclude patterns
  - Improved test isolation and fixtures

### Status Summary
- **Tests**: 269/269 passing ✅
- **Test Coverage**: 93.34% (exceeds >80% target by 13.34%) ✅
- **Total Test Files**: 19 files
- **Growth**: 199 → 269 tests (+70 tests, +35% growth)

---

## [2026-03-16] — Link Expiration, Password Protection & Analytics Enhancement

### Added
- **Link Expiration Feature**
  - `expires_at` field in qr_links table (migration: 20260316100000)
  - Form UI for expiration date selection
  - Redirect enforcement (410 if link expired)
  - Migration verified & deployed

- **Password-Protected Links**
  - PBKDF2-HMAC-SHA256 Web Crypto hashing with constant-time verification (`src/lib/password-utils.ts`); legacy SHA-256 backward compat
  - Password prompt on redirect (requires correct password before accessing target)
  - Form validation on create/edit link dialog
  - Migration verified & deployed

- **Analytics Date Range Filtering**
  - `analytics-date-range-picker.tsx` component
  - RPC support for custom date queries
  - Dashboard integration for filtered analytics
  - Migration verified & deployed

### Improved
- **Code Modularization** (db module refactored)
  - Split src/lib/db.ts (252 lines) → src/lib/db/{models,queries,mutations,utils}.ts
  - Barrel export at src/lib/db/index.ts (100% backward compatible)

- **Database Structure**
  - 3 new migrations applied (20260316100000, 20260316110000, 20260316120000)
  - Edge function redirect deployed to ybxmpuirarncxmenprzf project
  - RLS policies updated for new fields

- **Test Coverage** (18 tests added)
  - Component tests: edit-link-dialog.test.tsx, qr-preview.test.tsx (NEW)
  - Utility tests: password-utils.test.ts (NEW), use-link-mutations.test.ts (enhanced)
  - Tests: 141 → 159 passing (+18, +12.8%)

### Fixed
- Proxy-gateway security (F10, F13 red-team fixes)
- Supabase edge function hardening (+3 CORS/validation fixes)
- CORS headers in 3xx redirect response

### Status Summary
- **Tests**: 159/159 passing ✅
- **Test Coverage**: ~74% (estimated from new tests)
- **Deployments**: Vercel auto-deploy triggered, Supabase edge function updated
- **Database**: 3 migrations applied, RLS policies verified

---

## [2026-03-15] — Bypass URL Feature & Component Tests

### Added
- **Bypass URL Feature** (solves geo-blocking)
  - Bypass URL schema validation
  - Database column migration
  - Geo route form UI
  - Redirect priority: bypass_url → target_url → default_url
  - Analytics tracking (bypass flag)

- **Component Unit Tests** (53 tests)
  - LinkCard: 16 tests (render, actions, states)
  - StatsPanel: 20 tests (charts, data, formatting)
  - CreateLinkDialog: 17 tests (form validation, custom codes, errors)

### Fixed
- Short code custom format validation (`^[A-Z0-9_-]{3,20}$`)
- Day label formatting in StatsPanel (T12:00:00Z normalization)
- Create link error handling (INVALID_SHORT_CODE_FORMAT message)

### Status Summary
- **Tests**: 97 passing (88% increase from MVP)
- **Test Coverage**: 66%
- **Components Covered**: 60% of UI

---

## [2026-03-14] — Initial MVP Release

### Added
- **Core Features**
  - User authentication (Supabase email/password)
  - QR link creation with custom short codes
  - Geo-routing to 15 countries
  - Real-time click analytics (7-day chart, country pie, referers)
  - Dark/light theme support
  - Vietnamese UI language

- **Database**
  - qr_links, geo_routes, click_events tables
  - RLS policies for security
  - 6 migrations from scratch

- **Edge Functions**
  - Cloudflare redirect function (`/redirect/{shortCode}`)
  - Geo detection, rate limiting, bot filtering
  - CORS & protocol validation
  - Atomic click recording

- **Frontend**
  - React 18 + TypeScript + Vite
  - React Query v5 server state
  - react-hook-form + Zod validation
  - 45 shadcn/ui components
  - Framer Motion animations
  - Recharts analytics visualization

- **Testing & Quality**
  - Vitest + React Testing Library
  - 17 schema validation tests
  - 11 database utility tests
  - 8 auth context tests
  - 1 smoke test
  - ESLint + TypeScript strict mode

- **Deployment**
  - Vercel frontend
  - Supabase backend
  - Environment setup for prod/dev
  - Auto-deploy from GitHub

### Metrics
- Build time: ~10s
- Page load: <1.5s
- Redirect latency: ~50ms
- Bundle size: 239KB gzipped (main)
- Test coverage: 54%
- Tests: 37 passing

---

## Version Tracking

| Version | Date | Status | Tests | Coverage |
|---------|------|--------|-------|----------|
| v1.0-mvp | 2026-03-14 | Released | 37 | 54% |
| v1.1 | 2026-03-15 | Released | 97 | 66% |
| v1.2 | 2026-03-16 | Released | 159 | ~74% |
| v1.2-coverage-push | 2026-03-16 | Released | 269 | 93.34% ✅ |
| v1.3 | 2026-03-16 | Released | 289 | — (handler extraction + code split) |
| v1.4 | 2026-03-17 | Released | 289 + Playwright suite | — (QR persistence, exports, Sentry, bulk ops, E2E) |
| v1.5 | 2026-03-17 | Released | 308 (289 app + 19 worker) + 30 E2E | Worker production, E2E audit |
| v1.6 | 2026-03-17 | Released | 308 (289 app + 19 worker) + 30 E2E | GitHub Actions PR CI |
| v1.7 | 2026-03-17 | Released | 308 (289 app + 19 worker) + 30 E2E | Click webhook integrations |

---

## Breaking Changes

None documented. All releases maintain backward compatibility.

---

## Security Fixes

| Date | Issue | Severity | Fix |
|------|-------|----------|-----|
| 2026-03-16 | Weak RNG for short codes | High | Use crypto.randomUUID() |
| 2026-03-16 | User enumeration via auth errors | Medium | Normalize error messages |
| 2026-03-16 | Git token exposure | Critical | Remove from history + force-push |
| 2026-03-15 | Rate limiting bypass | Medium | Fixed 1 click/IP/60s enforcement |
| 2026-03-15 | Protocol validation | Medium | Block javascript:, data: URLs |

---

## Known Limitations

### Test Coverage
- ✅ EditLinkDialog: Tests complete (13 tests)
- ✅ QRPreview: Tests complete (5 tests)
- ✅ Database mutations: Tests complete (40+ tests)
- ✅ Page components: Tests complete (30+ tests)
- ✅ Redirect handler: Direct tests complete (13 tests) — exercises real edge logic
- Integration tests: Not yet written (planned)
- E2E tests: Playwright suite added; credentialed local dashboard flows verified, and PR CI wiring is complete
- Deployed edge-function plus live webhook verification still relies on manual smoke checks

### Analytics
- ✅ Date range filtering implemented
- ✅ Country-specific filters implemented (StatsPanel dropdown)
- No cached rollups for >30-day ranges

### Features
- ✅ Link expiration dates implemented
- ✅ Password-protected links implemented
- ✅ QR code customization persistence implemented
- ✅ Bulk import/export implemented

---

## Deployment Notes

### Frontend (Vercel)
- Deployed at: https://qrlive.vercel.app
- Auto-deploys from `main` branch
- Build command: `npm run build`
- Output directory: `dist/`

### Backend (Supabase)
- Edge function deployed to: supabase/functions/redirect
- Service role required for click insertion
- RLS policies enforce owner-only access

### Environment
- `.env.example` provided
- Requires: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
- Backend secret: SUPABASE_SERVICE_ROLE_KEY (set in Supabase dashboard)

---

## Deprecations

None yet.

---

## Contact

**Project Owner**: hthmkt12
**Repository**: https://github.com/hthmkt12/qrlive
**Live URL**: https://qrlive.vercel.app
**Last Updated**: 2026-03-17
