# Project Changelog

**QRLive** — Dynamic QR Code Link Shortener

All significant changes, features, and fixes documented here.

---

## [Unreleased]

### Planned Features
- EditLinkDialog unit tests (~15 tests)
- QRPreview unit tests (~5 tests)
- Advanced analytics filtering (date range, country)
- Link expiration dates
- Password protection on links

---

## [2026-03-16] — Major Fix & Hardening Session

### Fixed
- **Test Suite** (1 failing test resolved)
  - Fixed EditLinkDialog React portal querySelector bug
  - All 141 tests now passing (was 129 before session)

- **Linting** (0 remaining lint errors)
  - Resolved all no-explicit-any violations
  - Removed no-empty-object-type false positives
  - Excluded tooling directories (.claude, .vscode) from ESLint

- **Security Hardening** (3 vulnerabilities patched)
  - Replaced Math.random() with crypto.randomUUID() for short code generation
  - Normalized auth error messages to prevent user enumeration
  - Improved EditLinkDialog error toast with specific error descriptions

- **Git History** (Vercel token removed)
  - Removed leaked Vercel token from git history using filter-branch
  - Force-pushed to clean repository state

### Improved
- **Code Modularization** (src/lib/db.ts refactored)
  - Split db.ts (252 lines) into modular structure:
    - `src/lib/db/models.ts` — type definitions
    - `src/lib/db/queries.ts` — read operations
    - `src/lib/db/mutations.ts` — write operations
    - `src/lib/db/utils.ts` — utility functions
    - `src/lib/db/index.ts` — barrel export
  - Maintains 100% backward compatibility

- **Test Coverage** (8% improvement)
  - Added 12 unit tests for use-link-mutations hook
  - Coverage: 66% → 72% (~129 → 141 tests)

### Status Summary
- **Tests**: 141/141 passing ✅
- **Lint Errors**: 0 ✅
- **TypeScript Errors**: 0 ✅
- **Test Coverage**: 72% (8% above 64% baseline)

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
| v1.2 | 2026-03-16 | Current | 141 | 72% |

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
- EditLinkDialog: Tests pending (~15 needed)
- QRPreview: Tests pending (~5 needed)
- Integration tests: Not yet written
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

