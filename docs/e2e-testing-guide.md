# E2E Testing Guide — QRLive

Quick start guide for running Playwright E2E tests.

> Latest local verification (2026-03-17): `27 passed`, `4 skipped` with a seeded `qrlive.e2e@example.com` auth user. The remaining skips are the intentional local-development redirect cases in `redirect.spec.ts`.

## Quick Start

```bash
# Install dependencies (if not done)
npm install
npx playwright install chromium

# Run all E2E tests
npm run test:e2e

# Run with Playwright UI inspector
npm run test:e2e:ui

# Run a specific spec file
npx playwright test e2e/auth.spec.ts

# Run redirect API tests (no dev server needed)
npx playwright test -c playwright-redirect.config.ts
```

## Credential Setup

Most test suites require a seeded Supabase Auth user. Without credentials the tests **skip gracefully** with a hint message — they do not fail.

### 1. Create the test user in Supabase

Go to Supabase Dashboard → Authentication → Users → **Create user**:

- **Email**: `qrlive.e2e@example.com`
- **Password**: your choice (meets Supabase requirements)
- Confirm the email if email confirmation is enabled.

### 2. Store credentials locally

Create `.env.local` (never committed):

```bash
E2E_TEST_EMAIL=qrlive.e2e@example.com
E2E_TEST_PASSWORD=<your-chosen-password>
```

Or export in the shell:

```bash
export E2E_TEST_EMAIL=qrlive.e2e@example.com
export E2E_TEST_PASSWORD=<your-chosen-password>
```

> **Security**: The password belongs only in `.env.local` or CI secrets. Never commit it.

### Skip Behavior

All credential-gated suites use the same pattern:

```typescript
test.skip(!hasPresetCredentials, getCredentialSetupHint());
```

- **Creds absent** → entire describe block skips with message: *"Set E2E_TEST_EMAIL=… and E2E_TEST_PASSWORD in .env.local or the shell environment."*
- **Creds present** → tests authenticate via `authenticate(page, prefix)` helper and run normally.

## Test Suites

### Auth Tests (`e2e/auth.spec.ts`)

Unauthenticated redirect check + credentialed login/logout and session persistence.

**Status**: 1 test always runs; 2 tests credential-gated
**Run**: `npx playwright test e2e/auth.spec.ts`

### Dashboard Tests (`e2e/dashboard.spec.ts`)

Dashboard UI elements, create-link dialog, link list, and header info.

**Status**: 8 tests, all credential-gated (skip when creds absent)
**Run**: `npx playwright test e2e/dashboard.spec.ts`

### Link CRUD Tests (`e2e/link-crud.spec.ts`)

Create, edit, toggle active, and delete links.

**Status**: 4 tests, all credential-gated
**Run**: `npx playwright test e2e/link-crud.spec.ts`

### QR Customization Tests (`e2e/qr-customization.spec.ts`)

QR preset changes and PNG/SVG downloads.

**Status**: Credential-gated
**Run**: `npx playwright test e2e/qr-customization.spec.ts`

### Analytics Tests (`e2e/analytics.spec.ts`)

Stats view, range toggles, country filter, CSV export, back navigation.

**Status**: Credential-gated
**Run**: `npx playwright test e2e/analytics.spec.ts`

### Bulk Operations Tests (`e2e/bulk-operations.spec.ts`)

CSV export, import dialog, preview, validation errors.

**Status**: Credential-gated
**Run**: `npx playwright test e2e/bulk-operations.spec.ts`

### Redirect API Tests (`e2e/redirect.spec.ts`)

Redirect endpoint smoke checks against live deployment.

**Status**: No credentials needed
**Run**: `npx playwright test -c playwright-redirect.config.ts`

## Configuration Files

| File | Purpose |
|------|---------|
| `playwright.config.ts` | Main config — Chromium, Vite webServer on `127.0.0.1:5173` |
| `playwright-auth.config.ts` | Auth tests only (matches `**/auth.spec.ts`) |
| `playwright-redirect.config.ts` | Redirect API tests (no dev server) |

## File Structure

```
e2e/
├── e2e-test-helpers.ts       # Credential loading, auth helpers, dashboard actions
├── auth.spec.ts              # Auth flow tests
├── dashboard.spec.ts         # Dashboard UI tests (credential-gated)
├── link-crud.spec.ts         # CRUD tests
├── qr-customization.spec.ts  # QR preset tests
├── analytics.spec.ts         # Analytics tests
├── bulk-operations.spec.ts   # Bulk import/export tests
└── redirect.spec.ts          # Redirect API smoke tests

playwright.config.ts          # Main configuration
playwright-auth.config.ts     # Auth-only configuration
playwright-redirect.config.ts # Redirect-only configuration
```

## Common Commands

```bash
# Run with headed browser
npx playwright test --headed

# Run tests matching a pattern
npx playwright test -g "login"

# Generate and view HTML report
npx playwright test
npx playwright show-report

# Debug mode (step through tests)
npx playwright test --debug
```

## Notes

- Dev server runs on `http://127.0.0.1:5173` (Vite)
- Tests use Chromium only
- HTML report generated in `playwright-report/`
- Traces saved in `test-results/` on first retry
- webServer timeout is 120s in main config

## Troubleshooting

**Dev server won't start**: Check port 5173 isn't in use.

```bash
# Windows
netstat -ano | findstr :5173
# then: taskkill /PID <pid> /F

# macOS/Linux
lsof -ti:5173 | xargs kill -9
```

**Tests hang**: Playwright config uses 120s webServer timeout. Increase if needed in `playwright.config.ts`.

**All tests skip**: Credentials not set. See [Credential Setup](#credential-setup) above.
