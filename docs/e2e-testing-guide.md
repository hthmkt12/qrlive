# E2E Testing Guide — QRLive

Quick start guide for running Playwright E2E tests.

## Quick Start

```bash
# Install dependencies (if not done)
npm install

# Run all tests
npm run test:e2e

# Run with UI inspector
npm run test:e2e:ui

# Run specific test file
npx playwright test e2e/auth.spec.ts

# Run redirect API tests (no dev server needed)
npx playwright test -c playwright-redirect.config.ts
```

## Test Suites

### Auth Tests (`e2e/auth.spec.ts`)
Tests login form rendering, input handling, mode toggling, and redirect protection.

**Status**: ✅ 7/7 passing
**Requires**: Dev server running
**Run**: `npx playwright test -c playwright-auth.config.ts`

### Dashboard Tests (`e2e/dashboard.spec.ts`)
Tests dashboard UI, create link dialog, link list, and analytics.

**Status**: ⏳ 10/10 skipped (awaiting auth setup)
**Requires**: Authenticated session (TEST_EMAIL/TEST_PASSWORD env vars or test user)
**Note**: Unskip after setting up test user credentials

### Redirect API Tests (`e2e/redirect.spec.ts`)
Tests redirect API against live https://qrlive.vercel.app

**Status**: ✅ 6/10 passing, 4 skipped
**Requires**: None (tests live API)
**Run**: `npx playwright test -c playwright-redirect.config.ts`

## Environment Setup

### For Dashboard Tests (Optional)

Create `.env.local` or export:
```bash
export TEST_EMAIL="test@example.com"
export TEST_PASSWORD="your-password"
```

Then unskip dashboard tests in `e2e/dashboard.spec.ts` by removing `test.skip()`.

## Configuration Files

| File | Purpose |
|------|---------|
| `playwright.config.ts` | Main config (dev server + auth tests) |
| `playwright-auth.config.ts` | Auth tests only (with dev server) |
| `playwright-redirect.config.ts` | Redirect API tests (no dev server) |
| `playwright-fixture.ts` | Shared test exports |

## Common Commands

```bash
# Run all tests in watch mode
npx playwright test --watch

# Run with headed browser (see what's happening)
npx playwright test --headed

# Run single test
npx playwright test e2e/auth.spec.ts:10

# Run tests matching pattern
npx playwright test -g "login"

# Generate HTML report
npx playwright test
npx playwright show-report

# Debug mode (step through tests)
npx playwright test --debug
```

## File Structure

```
e2e/
├── auth.spec.ts          # Login form, auth flow tests
├── dashboard.spec.ts     # Dashboard UI tests (skipped)
└── redirect.spec.ts      # Redirect API tests

playwright.config.ts      # Main configuration
playwright-fixture.ts     # Test exports
```

## Notes

- Dev server runs on `http://localhost:8080` (Vite default)
- Tests use Chromium browser only
- HTML report generated in `playwright-report/`
- Traces saved in `test-results/` on first retry

## Troubleshooting

**Dev server won't start**: Check port 8080 isn't in use
```bash
# Kill processes on port 8080
lsof -ti:8080 | xargs kill -9  # macOS/Linux
netstat -ano | findstr :8080   # Windows (find PID, then taskkill /PID xxx)
```

**Tests hang**: Playwright config uses 60s webServer timeout. Increase if needed in `playwright.config.ts`

**localStorage errors**: Tests skip localStorage.clear() now. If you need it, use:
```typescript
await page.context().addInitScript(() => {
  localStorage.clear();
});
```

---

See `plans/reports/tester-260316-0339-e2e-playwright-setup.md` for full test report.
