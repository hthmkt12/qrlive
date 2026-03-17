# QRLive Codebase Summary

**Quick reference guide for developers and LLMs** | Updated 2026-03-17

---

## Project At a Glance

**QRLive** is a React-based QR code link shortener with:
- Geo-routing to 15 countries
- Bypass URLs for geo-blocking
- Real-time click analytics
- Click webhook notifications
- QR customization persistence
- Sentry error tracking
- Bulk CSV import/export
- Supabase backend + edge functions
- Vietnamese UI with dark/light themes

**Repository**: https://github.com/hthmkt12/qrlive
**Live**: https://qrlive.vercel.app
**Stack**: React 18 + TypeScript + Vite + Supabase + Edge Functions

---

## Key Stats

| Metric | Value |
|--------|-------|
| **Total Files** | 150+ |
| **Repo Tokens** | ~102K |
| **Tests** | 308 passing unit/integration tests (289 app + 19 worker) + 30 Playwright E2E |
| **Code Files** | ~60 (src/ + supabase/ + functions/) |
| **Dependencies** | 46 prod + 25 dev |
| **Build Time** | ~5s (passes; Vite chunk-size warning remains) |
| **Bundle Size** | 147KB gzipped (main), StatsPanel/StatsCharts lazy-loaded |
| **Last Updated** | 2026-03-17 (click webhooks, PR CI, worker prod setup, E2E audit, QR persistence, exports, Sentry, bulk ops) |

---

## Directory Structure

```
qrlive/
├── .github/
│   └── workflows/
│       └── ci.yml               # Pull request CI: lint, typecheck, tests, build, Playwright E2E
├── src/
│   ├── pages/                 # Route pages (Index, Auth, NotFound)
│   ├── components/            # Reusable UI + 45 shadcn/ui components
│   ├── contexts/              # Auth context provider
│   ├── hooks/                 # React hooks (useLinks, useLinkMutations)
│   ├── lib/                   # Schemas, types, utilities
│   │   ├── db/                # Database (modularized 2026-03-16)
│   │   │   ├── models.ts      # Type definitions
│   │   │   ├── queries.ts     # Read operations
│   │   │   ├── mutations.ts   # Write operations
│   │   │   ├── utils.ts       # Utility functions
│   │   │   └── index.ts       # Barrel export
│   │   ├── password-utils.ts  # PBKDF2-HMAC-SHA256 hashing & validation (legacy SHA-256 compat) [UPDATED 2026-03-16]
│   │   ├── schemas.ts         # Zod validation schemas
│   │   ├── types.ts           # TypeScript types
│   │   └── query-keys.ts      # React Query keys
│   ├── integrations/supabase/ # Supabase client & types
│   ├── test/                  # 289 unit/integration tests (24 files, app project)
│   ├── App.tsx                # Root component + routing (code-split)
│   ├── main.tsx               # Entry point
│   └── index.css              # Tailwind + global styles
│
├── supabase/
│   ├── functions/redirect/
│   │   ├── click-webhook.ts      # click.created payload builder + delivery helper [NEW 2026-03-17]
│   │   ├── redirect-handler.ts  # Runtime-agnostic handler logic [UPDATED 2026-03-17]
│   │   ├── redirect-password.ts # Password verification + protected-link form helper [NEW 2026-03-17]
│   │   └── index.ts             # Thin Deno wrapper + background webhook queueing
│   ├── functions/proxy/         # Content-fetch proxy (FALLBACK/TESTING ONLY)
│   └── migrations/            # 13 database migrations
│
├── cloudflare-worker/           # ✅ Canonical redirect-domain gateway (r.yourdomain.com → Supabase edge)
│   ├── redirect-proxy.js        # Worker handler (extractShortCode, buildUpstreamHeaders, fetch)
│   ├── redirect-proxy.test.js   # 19 Vitest tests (proxy contract, errors)
│   ├── wrangler.toml            # Wrangler deployment config
│   └── README.md                # Setup, secrets, deploy instructions
├── proxy-gateway/               # ✅ Canonical bypass gateway for bypass_url (Fly.io Tokyo)
├── public/                    # Static assets (favicon, robots.txt)
├── .claude/                   # Development context files
├── plans/                     # Development phase docs
├── docs/                      # Documentation (this folder)
├── package.json               # Dependencies & scripts
├── vite.config.ts             # Vite build config
├── vitest.config.ts           # Test config (test.projects: app + cloudflare-worker)
├── tailwind.config.ts         # Tailwind CSS
├── tsconfig.json              # TypeScript
├── .env.example               # Environment template
└── README.md                  # Project overview
```

Additional service: `proxy-gateway/` contains the always-on bypass gateway for HTTP/SOCKS5 vendor egress.

---

## Recent Additions (2026-03-17)

### New Library Modules
- **src/lib/sentry-config.ts** — Initializes `@sentry/react`, Browser Tracing, Replay sampling, and exports the shared error boundary
- **src/lib/analytics-export-utils.ts** — Generates analytics CSV payloads and triggers CSV/PDF export flows
- **src/lib/bulk-operations-utils.ts** — Parses CSV files, validates rows, groups geo routes, and generates dashboard CSV exports
- **src/lib/bulk-operations-schemas.ts** — Zod schemas + grouped-link types for bulk CSV import/export

### New UI Components
- **src/components/analytics-export-button.tsx** — Export dropdown used inside StatsPanel
- **src/components/bulk-import-dialog.tsx** — Drag-drop CSV import flow with preview/progress states
- **src/components/bulk-import-preview-table.tsx** — Scrollable row-by-row validation preview for imports
- **src/components/bulk-export-button.tsx** — Dashboard-level CSV export button for all links
- **src/components/link-geo-routes-fields.tsx** — Shared geo-route field-array UI used by create/edit dialogs

### New Edge Modules
- **supabase/functions/redirect/click-webhook.ts** — Builds `click.created` payloads and POSTs them with timeout + headers
- **supabase/functions/redirect/redirect-password.ts** — Extracted password hashing/verification + protected-link HTML form

### New E2E Surface
- **e2e/** — Playwright specs for auth, link CRUD, QR customization, analytics, and bulk operations, plus shared helpers
- **playwright.config.ts** — Chromium-only Playwright config with `webServer` booting Vite on port `5173`
- **.github/workflows/ci.yml** — PR CI workflow for lint, typecheck, Vitest, production build, and secret-gated Playwright E2E

---

## Core Components

### Pages (src/pages/)
- **Index.tsx** — Dashboard (protected, lists QR links + analytics)
- **Auth.tsx** — Login/signup form
- **NotFound.tsx** — 404 fallback

### Business Components (src/components/)
- **LinkCard.tsx** — Displays single QR link with actions
- **CreateLinkDialog.tsx** — Modal form to create new link (expiration, password, webhook)
- **EditLinkDialog.tsx** — Modal form to edit existing link (expiration, password, webhook)
- **link-geo-routes-fields.tsx** — Shared geo-route editor for both link dialogs
- **StatsPanel.tsx** — Analytics: 7-day chart, country pie, referer list
- **QRPreview.tsx** — Renders QR code for short URL
- **analytics-date-range-picker.tsx** — Date range selector for analytics queries [NEW 2026-03-16]
- **analytics-export-button.tsx** — Dropdown trigger for CSV/PDF analytics export [NEW 2026-03-17]
- **bulk-import-dialog.tsx** — CSV upload/import modal with drag-drop, preview, progress [NEW 2026-03-17]
- **bulk-import-preview-table.tsx** — Validation preview table for uploaded CSV rows [NEW 2026-03-17]
- **bulk-export-button.tsx** — One-click CSV export for dashboard links [NEW 2026-03-17]

### UI Components (src/components/ui/)
45 shadcn/ui (Radix UI) components:
- Forms: Input, Textarea, Select, Checkbox, RadioGroup, Toggle
- Layout: Card, Dialog, Sheet, Drawer, Popover, Tooltip, Sidebar
- Display: Badge, Alert, Accordion, Tabs, Table, Carousel
- Feedback: Toast, AlertDialog, ContextMenu, HoverCard

---

## Key Hooks & Context

### useAuth() (src/contexts/auth-context.tsx)
```typescript
{
  user: User | null,
  session: Session | null,
  loading: boolean,
  signIn: (email, password) => Promise<void>,
  signUp: (email, password) => Promise<void>,
  signOut: () => Promise<void>
}
```

### useLinks() (src/hooks/use-links.ts)
Fetches links + geo routes only; analytics are split into separate summary/detail queries.

### useLinkAnalyticsSummaries() / useLinkAnalyticsDetail() (src/hooks/use-links.ts)
Fetch aggregated dashboard metrics and selected-link analytics detail via Supabase RPCs.

### useLinkMutations() (src/hooks/use-link-mutations.ts)
```typescript
{
  createLink: UseMutationResult,
  updateLink: UseMutationResult,
  updateGeoRoutes: UseMutationResult,
  toggleLink: UseMutationResult,
  deleteLink: UseMutationResult
}
```

### useMobile() (src/hooks/use-mobile.tsx)
Detects mobile breakpoint (768px).

---

## Database Schema

### qr_links
```sql
id UUID PRIMARY KEY
user_id UUID FK → auth.users(id)
name TEXT
short_code TEXT UNIQUE  -- auto-generated: ^[A-Z0-9]{6}$ OR custom: ^[A-Z0-9_-]{3,20}$ (validated & collision-safe)
default_url TEXT
webhook_url TEXT (nullable)      -- [NEW 2026-03-17] optional click webhook endpoint
is_active BOOLEAN
expires_at TIMESTAMP (nullable)  -- [NEW 2026-03-16] link expiration date
password_hash TEXT (nullable)    -- [UPDATED 2026-03-16] PBKDF2 self-describing format (legacy SHA-256 compat)
created_at TIMESTAMP
updated_at TIMESTAMP

RLS: owner-only (SELECT, INSERT, UPDATE, DELETE)
Validation: custom codes validated in db/utils.ts before INSERT; reject invalid format
```

### geo_routes
```sql
id UUID PRIMARY KEY
link_id UUID FK → qr_links(id) CASCADE
country TEXT
country_code TEXT
target_url TEXT
bypass_url TEXT (nullable)

RLS: inherited from qr_links ownership
UNIQUE(link_id, country_code)
```

### click_events
```sql
id UUID PRIMARY KEY
link_id UUID FK → qr_links(id) CASCADE
country TEXT
country_code TEXT
ip_address TEXT
user_agent TEXT
referer TEXT (truncated ≤500 chars)
created_at TIMESTAMP

RLS: RESTRICTED INSERT (service role only via edge function, no public INSERT)
RLS: Owner-only SELECT
```

---

## Validation Schemas (lib/schemas.ts)

All in one file, all Vietnamese error messages:

```typescript
geoRouteSchema      // Single geo route validation
linkFormSchema      // Create/edit link form
authSchema          // Signup/login form
```

**Types auto-generated**:
```typescript
type GeoRouteInput = z.infer<typeof geoRouteSchema>
type LinkFormInput = z.infer<typeof linkFormSchema>
type AuthInput = z.infer<typeof authSchema>
```

---

## React Query Setup

### Query Keys (lib/query-keys.ts)
```typescript
links: ["links"]
link: (id) => ["links", id]
analytics: {
  all: ["links", "analytics"],
  summaries: (linkIds) => ["links", "analytics", "summaries", ...linkIds],
  detail: (id) => ["links", "analytics", "detail", id],
}
```

### Mutations Auto-Refetch
Create/update/delete mutations trigger targeted invalidation for `QUERY_KEYS.links` and `QUERY_KEYS.analytics.all`.

---

## Edge Function: redirect/{shortCode}

**Path**: supabase/functions/redirect/redirect-handler.ts (logic) + index.ts (Deno wrapper)
**Runtime**: Deno (index.ts wraps the runtime-agnostic handler)
**Access**: Service role (bypasses RLS)

**Flow**:
1. Validate short code (`^[A-Z0-9_-]{3,20}$`)
2. Fetch link + geo_routes (service role)
3. Check expiration: if `expires_at` is in past, return 410 Gone
4. If password_hash exists, prompt user for password before redirect
5. Extract geo data: country (cf-ipcountry), IP, user-agent, referer
6. Check bot pattern (skip recording for crawlers)
7. Rate limit check (1 click/IP/60s)
8. Resolve redirect: bypass_url → target_url → default_url
9. Validate protocol (^https?://)
10. Record click if pass all checks
11. Queue optional `click.created` webhook in background
12. Return 302 + no-store cache headers

**Key Details**:
- Handler logic extracted into `redirect-handler.ts` with `SupabaseAdapter` interface for testability
- Background webhook delivery uses `EdgeRuntime.waitUntil` in `index.ts`
- Geo detection: Cloudflare header only (local dev: manual header)
- Bot pattern: `/bot|crawler|spider|prerender|headless|facebookexternalhit|twitterbot|slurp/i`
- Rate limiting: Query last 60s, skip if count > 0
- CORS: Enabled for all origins
- Expiration: Return 410 Gone if link expired
- Password: PBKDF2-HMAC-SHA256 verification with constant-time comparison; legacy SHA-256 compat; opportunistic rehash
- Webhook payload: `click.created` with link info, redirect target, geo-routing flag, country code, and referer

---

## Environment Variables

### Required
```
VITE_SUPABASE_URL=https://[project].supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=[anon-key]
```

### For Edge Function (Supabase secrets)
```
SUPABASE_SERVICE_ROLE_KEY=[service-role-key]
```

### Optional for credentialed E2E dashboard flows
```
E2E_TEST_EMAIL=[seeded-test-user-email]
E2E_TEST_PASSWORD=[seeded-test-user-password]
```

---

## Testing (308 unit/integration tests + 30 Playwright E2E)

### High-Level Breakdown

**App project (289 tests, jsdom):**
- **Schemas & Validation** — auth, links, geo-routes, URL validation, and optional webhook URLs
- **Database & Data Layer** — db utils, mutations, query helpers, and query keys
- **Auth Context & Hooks** — session lifecycle, sign in/up/out, normalized errors, and query wiring
- **Pages & UI Components** — Auth, Index, NotFound, LinkCard, StatsPanel, Create/Edit dialogs, QRPreview, analytics, and bulk flows
- **Redirect Integration (simulator)** — password, expiration, geo-routing, and redirect flow behavior
- **Redirect Handler + Webhook Helpers** — direct tests against `redirect-handler.ts` plus `click-webhook.ts`
- **App Smoke** — Vitest wiring

**Cloudflare Worker project (19 tests, node):**
- **extractShortCode** (5 tests) — `/CODE`, `/r/CODE`, edge cases
- **buildUpstreamHeaders** (4 tests) — auth injection, geo-routing preservation, header filtering
- **Proxy forwarding contract** (6 tests) — upstream URL, auth headers, POST body, redirect:manual
- **Error handling** (4 tests) — missing secrets, empty code, CORS, unsupported methods

### Playwright E2E Coverage (30 passed, 0 skipped)
- `e2e/auth.spec.ts` — unauthenticated redirect plus credentialed login/session flows
- `e2e/link-crud.spec.ts` — create, edit, toggle active, delete
- `e2e/qr-customization.spec.ts` — QR preset change + PNG/SVG downloads
- `e2e/analytics.spec.ts` — stats view, range toggles, country filter, CSV export, back navigation
- `e2e/bulk-operations.spec.ts` — CSV export, import dialog, preview, validation errors
- `e2e/redirect.spec.ts` — live redirect endpoint smoke checks
- `e2e/dashboard.spec.ts` — credential-gated dashboard flows with Vietnamese UI selectors

Auth-gated specs read `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD` from `.env.local` or shell env. Without them, those specs skip cleanly instead of failing on Supabase email-rate limits.

### Direct Redirect Handler Coverage
- OPTIONS preflight → 200 + CORS
- Invalid short code → 400
- Missing/inactive link → 404
- Expired link → 410
- Password-protected GET → 200 form
- Wrong password → 401
- Correct password → 302
- Legacy SHA-256 opportunistic rehash
- Geo-routing priority (bypass → target → default)
- Bot traffic skips click insert
- Non-bot records click
- Duplicate click within 60s skipped
- Background webhook queueing + failure isolation
- Non-http URL → 400

### Proxy Gateway Smoke Tests (3 tests)
- Health endpoint
- Header forwarding + redirect rewriting
- Config validation + proxy agent selection

### Vitest Projects

`vitest.config.ts` uses `test.projects` to run two test environments under a single `npm test`:
- **app** — jsdom, React plugin, `src/test/setup.ts`, includes `src/**/*.test.*`
- **cloudflare-worker** — node, no setupFiles, includes `cloudflare-worker/**/*.test.*`

**Run Tests**:
```bash
npm run test          # Run all 308 tests (app + worker)
npm run gateway:test  # Run proxy-gateway smoke tests
npm run test:e2e      # Playwright E2E (30 tests)
npm run test:watch   # Watch mode
```

---

## Build & Deploy

### Development
```bash
npm install
npm run dev           # Vite dev server (default: http://localhost:8080)
npm run typecheck    # TypeScript check
npm run lint         # ESLint
npm run test:e2e     # Playwright E2E (boots Vite on http://127.0.0.1:5173)
```

### Production
```bash
npm run build        # Vite build → dist/
npm run preview      # Preview production build
```

### Deploy Frontend (Vercel)
```bash
vercel --prod
# Or auto-deploy from GitHub push to main
```

### Deploy Backend (Supabase)
```bash
supabase functions deploy redirect --no-verify-jwt
```

---

## Key Files Reference

| File | Purpose |
|------|---------|
| **src/App.tsx** | Root component, routing, providers setup |
| **src/lib/db/index.ts** | Barrel export (queries, mutations, models, utils) |
| **src/lib/db/queries.ts** | Supabase read operations (fetch links, get analytics) |
| **src/lib/db/mutations.ts** | Supabase write operations (create, update, delete) |
| **src/lib/db/models.ts** | Type definitions for queries/mutations |
| **src/lib/db/utils.ts** | Database utilities (code generation, validation) |
| **src/lib/password-utils.ts** | PBKDF2-HMAC-SHA256 hashing, constant-time verify, legacy SHA-256 compat [UPDATED 2026-03-16] |
| **src/lib/sentry-config.ts** | Sentry init, tracing/replay integration, shared error boundary [NEW 2026-03-17] |
| **src/lib/analytics-export-utils.ts** | CSV/PDF analytics export helpers [NEW 2026-03-17] |
| **src/lib/bulk-operations-utils.ts** | CSV parse/export helpers for bulk import/export [NEW 2026-03-17] |
| **src/lib/bulk-operations-schemas.ts** | Zod schemas + grouped-link types for CSV workflows [NEW 2026-03-17] |
| **src/lib/schemas.ts** | Zod validation schemas (centralized) |
| **src/lib/types.ts** | COUNTRIES list, TypeScript types |
| **src/contexts/auth-context.tsx** | Auth state + methods (useAuth hook) |
| **src/hooks/use-links.ts** | React Query: fetch links |
| **src/hooks/use-link-mutations.ts** | React Query: mutations with refetch |
| **src/pages/Index.tsx** | Dashboard (main page) |
| **src/components/LinkCard.tsx** | Link display + actions |
| **src/components/CreateLinkDialog.tsx** | Create form modal (includes optional click webhook) |
| **src/components/EditLinkDialog.tsx** | Edit form modal (expiration, password, webhook) |
| **src/components/link-geo-routes-fields.tsx** | Shared geo-route field array for create/edit dialogs |
| **src/components/analytics-date-range-picker.tsx** | Date range selector [NEW 2026-03-16] |
| **src/components/analytics-export-button.tsx** | CSV/PDF export dropdown trigger [NEW 2026-03-17] |
| **src/components/bulk-import-dialog.tsx** | CSV import modal with drag-drop + progress [NEW 2026-03-17] |
| **src/components/bulk-import-preview-table.tsx** | Validation preview table for imported CSV rows [NEW 2026-03-17] |
| **src/components/bulk-export-button.tsx** | Dashboard-level CSV export trigger [NEW 2026-03-17] |
| **src/components/StatsPanel.tsx** | Analytics visualization |
| **playwright.config.ts** | Playwright config, Chromium project, `webServer` bootstrap [NEW 2026-03-17] |
| **e2e/** | Playwright E2E specs + shared helper layer [NEW 2026-03-17] |
| **cloudflare-worker/redirect-proxy.js** | Worker handler: extractShortCode, buildUpstreamHeaders, fetch proxy [REWRITTEN 2026-03-17] |
| **cloudflare-worker/redirect-proxy.test.js** | 19 Vitest tests: proxy contract, headers, errors [NEW 2026-03-17] |
| **cloudflare-worker/wrangler.toml** | Wrangler deployment config (secrets: SUPABASE_URL, SUPABASE_ANON_KEY) |
| **cloudflare-worker/README.md** | Worker setup, secrets, deploy, test instructions [NEW 2026-03-17] |
| **supabase/functions/redirect/click-webhook.ts** | `click.created` payload builder + POST delivery helper [NEW 2026-03-17] |
| **supabase/functions/redirect/redirect-handler.ts** | Runtime-agnostic redirect handler logic (webhook queueing + click gating) [UPDATED 2026-03-17] |
| **supabase/functions/redirect/redirect-password.ts** | Password verification + protected-link form HTML [NEW 2026-03-17] |
| **supabase/functions/redirect/index.ts** | Thin Deno wrapper for redirect handler + background tasks |

---

## Key Dependencies

### Frontend
| Package | Version | Use |
|---------|---------|-----|
| react | 18.3.1 | UI library |
| @tanstack/react-query | 5.83.0 | Server state |
| @supabase/supabase-js | 2.99.1 | Backend |
| react-hook-form | 7.61.1 | Forms |
| zod | 3.25.76 | Validation |
| shadcn/ui | Latest | UI components |
| tailwindcss | 3.4.17 | Styling |
| framer-motion | 12.36.0 | Animations |
| recharts | 2.15.4 | Charts |
| qrcode.react | 4.2.0 | QR codes |
| next-themes | 0.3.0 | Dark/light theme |

### Backend
| Package | Version | Use |
|---------|---------|-----|
| @supabase/supabase-js | 2.99.1 | Supabase client (Deno) |

### Dev
| Package | Version | Use |
|---------|---------|-----|
| vite | 5.4.19 | Build tool |
| typescript | 5.8.3 | Type checking |
| vitest | 3.2.4 | Test runner |
| @testing-library/react | 16.0.0 | Component testing |

---

## Common Tasks

### Add a New Page
1. Create `src/pages/NewPage.tsx`
2. Import in `App.tsx`
3. Add route: `<Route path="/new-page" element={<NewPage />} />`

### Add a New Component
1. Create `src/components/NewComponent.tsx`
2. If uses forms: use zod + react-hook-form pattern
3. Export from file, import where needed

### Add a Database Query
1. Add function in `src/lib/db.ts`
2. Create/update React Query hook in `src/hooks/`
3. Use in component via hook

### Add Validation
1. Add schema to `src/lib/schemas.ts`
2. Use in form via `useForm(zodResolver(schema))`
3. Add test in `src/test/schemas.test.ts`

### Deploy Changes
```bash
# Frontend: Push to GitHub
git push origin main
# (Vercel auto-deploys)

# Backend: Deploy edge function
supabase functions deploy redirect --no-verify-jwt
```

---

## Performance Notes

- **Redirect latency**: ~50ms (Cloudflare edge)
- **Page load**: ~1.5s (Vercel CDN + React)
- **Database queries**: ~50-100ms (Supabase)
- **Main bundle**: 147KB gzipped (code-split, optimized)
- **Index page chunk**: 70KB gzipped
- **StatsCharts chunk**: 107KB gzipped (lazy-loaded with Suspense)
- **StatsPanel shell**: 4KB gzipped
- **React Query caching**: Immediate refetch on mutation
- **Analytics**: `analyticsByLinkId` wrapped in `useMemo` for perf

---

## Security Notes

- ✅ RLS on all tables (owner-only qr_links, inherited geo_routes, service-role-only click_events INSERT)
- ✅ Auth context always resolves loading state
- ✅ URL protocol validation (block javascript:, data:)
- ✅ Short code validation: auto `^[A-Z0-9]{6}$`, custom `^[A-Z0-9_-]{3,20}$` (regex enforced in db.ts before INSERT)
- ✅ Custom short code collision detection (UNIQUE constraint + try-catch)
- ✅ Rate limiting (1 click/IP/60s)
- ✅ Bot filtering (crawlers don't count)
- ✅ SSRF protection (block private IPs: localhost, 10.x, 172.16-31.x, 192.168.x, 169.254.x) in supabase/functions/proxy
- ✅ Referer truncation ≤500 chars in redirect function
- ✅ CORS headers on edge function
- ✅ Click events INSERT restricted to service role (removed public policy)

---

## Known Issues

| Issue | Severity | Fix Time | Status |
|-------|----------|----------|--------|
| App/component/hook test expansion | Medium | ✅ Complete | 289 tests across 24 files |
| Redirect handler + webhook helper tests | Medium | ✅ Complete | 2026-03-17 |
| Long-range analytics pre-aggregation | Medium | 1-2 hours | Pending |
| Main bundle size reduction (790KB → 490KB) | Low | ✅ Fixed | Code-split, lazy-loaded |
| db.ts modularization (252 → 5 files) | Low | ✅ Fixed | 2026-03-16 |
| Lint errors (no-explicit-any, no-empty-object-type) | Medium | ✅ Fixed | 2026-03-16 |
| Security: weak RNG + auth errors + git token | High | ✅ Fixed | crypto.randomUUID(), error normalization, history cleaned |
| Proxy gateway red-team fixes (F10, F13) | High | ✅ Fixed | 2026-03-16 |

---

## Useful Commands

```bash
# Development
npm run dev              # Start dev server
npm run typecheck       # Type check
npm run lint            # Lint code

# Testing
npm run test            # Run tests once
npm run test:e2e        # Run Playwright E2E suite
npm run test:e2e:ui     # Open Playwright UI mode
npm run gateway:test    # Run proxy-gateway smoke tests
npm run test:watch     # Watch mode

# Building
npm run build           # Production build
npm run preview         # Preview build

# Supabase
supabase start          # Local Supabase
supabase db push        # Apply migrations
supabase functions deploy redirect --no-verify-jwt

# Git
git status              # Check changes
git add .               # Stage all
git commit -m "..."     # Commit
git push origin main    # Push to GitHub
```

---

## Quick Links

- **Repository**: https://github.com/hthmkt12/qrlive
- **Live URL**: https://qrlive.vercel.app
- **Supabase Dashboard**: https://app.supabase.com/projects
- **Vercel Dashboard**: https://vercel.com/dashboard
- **React Docs**: https://react.dev
- **Supabase Docs**: https://supabase.com/docs
- **Tailwind Docs**: https://tailwindcss.com/docs
- **Zod Docs**: https://zod.dev

---

## Contributing Guidelines

1. **Read** `docs/code-standards.md` for naming & patterns
2. **Create branch**: `git checkout -b feature/my-feature`
3. **Make changes** following standards
4. **Test**: `npm run test`
5. **Type check**: `npm run typecheck`
6. **Lint**: `npm run lint`
7. **Commit**: Use conventional commits (feat:, fix:, docs:)
8. **Push**: `git push origin feature/my-feature`
9. **PR**: Submit pull request with description

---

## Support

For issues or questions:
1. Check `docs/` folder
2. Open GitHub issue
3. Review architecture in `docs/system-architecture.md`
4. Check deployment guide `docs/deployment-guide.md`

---

## License

Project owned by hthmkt12. See LICENSE file for details.

---

**Last Updated**: 2026-03-17 (click webhooks, worker prod setup, E2E audit, QR persistence, Sentry, analytics export, bulk ops)
**Next Review**: 2026-04-16
**Version**: v1.7 | **Tests**: 308/308 unit+integration passing (289 app + 19 worker) + 30 E2E | **Status**: Production-ready
