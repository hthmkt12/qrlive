# Project Changelog

**QRLive** — Dynamic QR Code Link Shortener

All significant changes, features, and fixes documented here.

---

## [Unreleased]

### Planned Features
- E2E tests (Playwright)
- Edge function integration tests (Deno)
- Country-specific analytics filtering (pie chart → detail page)
- QR code customization (colors, logo, border)
- Bulk import/export functionality

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
  - Redirect enforcement (403 if link expired)
  - Migration verified & deployed

- **Password-Protected Links**
  - SHA-256 Web Crypto hashing (`src/lib/password-utils.ts`)
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
- ✅ EditLinkDialog: Tests complete (13 tests) — 2026-03-16
- ✅ QRPreview: Tests complete (5 tests) — 2026-03-16
- ✅ Database mutations: Tests complete (40+ tests) — 2026-03-16
- ✅ Page components: Tests complete (30+ tests) — 2026-03-16
- Integration tests: Not yet written (planned)
- E2E tests: Playwright fixtures exist but not in CI

### Analytics
- Date range filtering not yet implemented
- Country-specific filters UI pending
- No cached rollups for >30-day ranges

### Features
- No link expiration dates
- No password protection
- No QR code customization
- No bulk import/export

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
**Last Updated**: 2026-03-16

