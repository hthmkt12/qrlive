# QRLive — Dynamic QR Code Link Shortener

A production-ready QR code link management platform with geo-routing, bypass URLs, and real-time analytics. Create short, scannable links that intelligently redirect users based on their geographic location.

**Live**: https://qrlive.vercel.app
**Repository**: https://github.com/hthmkt12/qrlive
**Database**: Supabase (ybxmpuirarncxmenprzf)

---

## Features

### Core Functionality
- **Auth System**: Email/password signup, login, logout with session persistence
- **QR Link Management**: Create, edit, delete, and toggle QR links with auto-generated 6-character codes or custom 3-20 character short codes
- **Protected & Expiring Links**: Optional password protection plus expiration dates enforced by the redirect edge function
- **Geo-Routing**: Route visitors to different URLs based on 15 supported countries (US, GB, JP, KR, DE, FR, VN, TH, SG, AU, CA, BR, IN, CN, RU)
- **Bypass URLs**: Optional override URLs for accessing geo-blocked content (priority: bypass_url → target_url → default_url)
- **Click Analytics**: Real-time tracking with date range filtering, country distribution, referer breakdown, and bot filtering
- **Click Webhooks**: Optional per-link `click.created` POST notifications for recorded clicks

### User Experience
- **Vietnamese UI**: All text localized for Vietnamese users
- **Dark/Light Theme**: Toggle between themes with next-themes
- **Responsive Design**: Works on desktop and mobile (tailored grid layout)
- **Smooth Animations**: Framer Motion animations for link creation/deletion
- **Loading States**: Skeleton screens instead of spinners
- **Toast Notifications**: Immediate feedback on actions

---

## Tech Stack

| Layer | Technologies |
|-------|--------------|
| **Frontend** | React 18 + TypeScript + Vite |
| **Styling** | Tailwind CSS + shadcn/ui (45 Radix UI components) |
| **State** | TanStack React Query v5 |
| **Forms** | react-hook-form + zod validation |
| **Auth** | Supabase Auth (email/password) |
| **Database** | Supabase Postgres with RLS policies |
| **Edge Functions** | Supabase Edge Functions (Deno runtime) |
| **Charts** | Recharts (7-day, country, referer) |
| **QR Codes** | qrcode.react |
| **Deploy** | Vercel (frontend) + Supabase (backend) |

---

## Quick Start

### Prerequisites
- Node.js 18+ ([install via nvm](https://github.com/nvm-sh/nvm#installing-and-updating))
- npm 9+
- Supabase CLI (optional, for local testing)

### Development Setup

```bash
# 1. Clone repository
git clone https://github.com/hthmkt12/qrlive.git
cd qrlive

# 2. Install dependencies
npm install

# 3. Create environment file
cp .env.example .env.local
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY

# 4. Start development server
npm run dev
# Open http://localhost:5173
```

### Environment Variables

Create `.env.local`:
```
VITE_SUPABASE_URL=https://ybxmpuirarncxmenprzf.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-publishable-key>
```

Get credentials from [Supabase Dashboard](https://app.supabase.com/projects).

---

## Project Structure

```
src/
├── pages/               # Route pages (Index, Auth, NotFound) — lazy-loaded
├── components/          # Reusable UI + business components
│   ├── LinkCard.tsx
│   ├── CreateLinkDialog.tsx
│   ├── EditLinkDialog.tsx
│   ├── StatsPanel.tsx   # Shell (12 KB) — lazy-loads StatsCharts
│   ├── StatsCharts.tsx  # Recharts visualizations (loaded on demand)
│   ├── DashboardHeader.tsx
│   ├── DashboardMetrics.tsx
│   └── ui/             # 45 shadcn/ui components
├── contexts/            # Auth context provider
├── hooks/               # useLinks, useLinkMutations, useMobile
├── lib/                 # Database ops, schemas, types, utilities
├── integrations/        # Supabase client
├── test/                # 289 app tests across 24 files (jsdom project)
└── App.tsx              # Root component + routing (code-split)

supabase/
├── functions/redirect/
│   ├── click-webhook.ts     # click.created payload builder + delivery helper
│   ├── redirect-handler.ts  # Runtime-agnostic handler logic (testable)
│   ├── redirect-password.ts # Password form + verification helpers
│   └── index.ts             # Thin Deno wrapper + background webhook queueing
├── functions/proxy/         # Content-fetch proxy (FALLBACK/TESTING ONLY)
└── migrations/          # 13 database migrations

cloudflare-worker/           # Redirect-domain gateway (r.yourdomain.com → Supabase edge)
proxy-gateway/               # Canonical bypass gateway for bypass_url (Fly.io Tokyo)
docs/                    # Documentation (see below)
```

---

## Documentation

All documentation is in the `docs/` directory:

| Document | Purpose |
|----------|---------|
| **[project-overview-pdr.md](./docs/project-overview-pdr.md)** | Project goals, features, user stories, acceptance criteria |
| **[system-architecture.md](./docs/system-architecture.md)** | Architecture diagrams, data flow, database schema, edge function flow |
| **[code-standards.md](./docs/code-standards.md)** | File structure, naming conventions, patterns, testing |
| **[deployment-guide.md](./docs/deployment-guide.md)** | Step-by-step setup: local, Supabase, Vercel, edge functions |
| **[project-roadmap.md](./docs/project-roadmap.md)** | Status, completed features, known issues, future plans |
| **[codebase-summary.md](./docs/codebase-summary.md)** | Quick reference for developers and LLMs |
| **[openapi.yaml](./docs/openapi.yaml)** | Machine-readable contract for redirect endpoints, proxy surfaces, and click webhooks |

---

## Key Commands

```bash
# Development
npm run dev              # Start Vite dev server (http://localhost:5173)
npm run typecheck       # TypeScript type checking
npm run lint            # ESLint code quality

# Testing
npm run test            # Run full test suite (308 Vitest tests across 25 files)
npm run test:watch     # Watch mode for development

# Building
npm run build           # Production build (vite build)
npm run preview         # Preview production build locally

# Local Supabase (optional)
supabase start          # Start local Postgres + Auth + Edge Functions
supabase db push        # Apply migrations

# Proxy gateway (optional, for bypass_url deployment)
npm run gateway:install # Install proxy-gateway dependencies
npm run gateway:dev     # Run always-on gateway locally
npm run gateway:check   # Smoke-check gateway module loading
npm run gateway:test    # Run proxy-gateway smoke tests
```

---

## Testing

308 unit/integration tests across 25 test files covering:
- **Schemas & Validation**: Zod validation for links, auth, geo routes, and optional webhook URLs
- **Database & Data Layer**: db utilities, mutations, query helpers, and query keys
- **Auth Context & Hooks**: session lifecycle, query wiring, and password hashing helpers
- **Pages & UI Components**: Index/Auth/NotFound plus dialogs, cards, stats, QR preview, analytics controls
- **Redirect Logic**: simulator coverage plus direct handler tests for password, expiration, geo-routing, bot filtering, duplicate suppression, and click webhooks
- **Cloudflare Worker**: proxy contract, auth header injection, POST forwarding, and fail-fast errors

Run tests:
```bash
npm run test          # Run all 308 tests
npm run gateway:test  # Proxy-gateway smoke tests (3 tests)
npm run test:watch   # Watch mode
```

---

## Architecture Highlights

### Authentication
- Supabase Auth manages sessions (JWT tokens)
- Auth context always resolves loading state (prevents flash)
- RLS policies enforce user data isolation

### Geo-Routing
- Geo detection via Cloudflare `cf-ipcountry` header (edge-only)
- Redirect priority: bypass_url → target_url → default_url
- Fallback to default_url if geo data unavailable

### Edge Function (redirect/{shortCode})
- Validates short code format (`^[A-Z0-9_-]{3,20}$`)
- Rate limits to 1 click per IP per 60 seconds
- Filters bots/crawlers (skip click recording)
- Records click events for analytics
- Queues optional `click.created` webhooks in the background after recorded clicks
- Returns 302 redirect with no-cache headers

### Database Security
- RLS policies on all tables (owner-only for user data)
- Service role used only in edge function (for public INSERT)
- Atomic geo route updates via Postgres RPC function

---

## Known Issues & Roadmap

### Current Issues (Medium Priority)
1. Detailed analytics use server-side aggregate RPCs, but very high-volume or long-range reporting will eventually want pre-aggregated rollups or caching
2. Full deployed edge-to-webhook verification is still a manual smoke test rather than an automated production monitor

### Implemented (Shipped)
- ✅ Password-protected links (PBKDF2-HMAC-SHA256 with legacy SHA-256 compatibility)
- ✅ Link expiration dates
- ✅ Advanced analytics (date range filtering, country/referer breakdown)
- ✅ Route-level code splitting and lazy-loaded analytics charts

### Planned Features (Q2 2026)
- Team collaboration
- Slack / Zapier integrations
- Mobile apps (iOS/Android)

See [project-roadmap.md](./docs/project-roadmap.md) for full details.

---

## Deployment

### Frontend (Vercel)
```bash
vercel --prod
# Or auto-deploy: push to main branch on GitHub
```

### Backend (Supabase)
```bash
supabase functions deploy redirect --no-verify-jwt
```

### Optional Bypass Gateway
```bash
cd proxy-gateway
npm install
npm run test
npm run start
```

See [deployment-guide.md](./docs/deployment-guide.md) for detailed instructions.

---

## Performance

| Metric | Target | Actual |
|--------|--------|--------|
| Redirect Latency | <100ms | ~50ms (Cloudflare edge) |
| Page Load | <2s | ~1.5s (Vercel CDN) |
| Build Time | <30s | ~5s (passes; Vite chunk-size warning remains) |
| Tests | — | 308/308 passing (25 files) |
| Uptime | 99.9% | 100% (current) |

### Build Chunks (code-split)

| Chunk | Size | Gzip |
|-------|------|------|
| Main bundle | 490 KB | 147 KB |
| Index page | 213 KB | 70 KB |
| StatsCharts (lazy) | 393 KB | 107 KB |
| StatsPanel shell | 12 KB | 4 KB |
| Schemas | 86 KB | 24 KB |

---

## Security

- ✅ RLS (Row-Level Security) on all database tables
- ✅ Password hashing: PBKDF2-HMAC-SHA256 (600k iterations) with legacy SHA-256 compatibility
- ✅ Dashboard never exposes password hashes (uses `has_password` boolean)
- ✅ URL protocol validation (blocks javascript:, data: injection)
- ✅ Rate limiting (1 click per IP per 60s)
- ✅ Bot filtering (skips analytics for crawlers)
- ✅ CORS headers on edge function
- ✅ Session persistence via Supabase JS client (`localStorage` in current app config)

---

## Contributing

1. Read [code-standards.md](./docs/code-standards.md)
2. Create feature branch: `git checkout -b feature/my-feature`
3. Make changes, test, lint: `npm run test && npm run lint`
4. Commit with conventional format: `git commit -m "feat: add new feature"`
5. Push and submit PR

---

## Support & Resources

- **Docs**: See `docs/` directory
- **Issues**: https://github.com/hthmkt12/qrlive/issues
- **Supabase Docs**: https://supabase.com/docs
- **Vercel Docs**: https://vercel.com/docs
- **React**: https://react.dev
- **Tailwind**: https://tailwindcss.com

---

## License

Project by hthmkt12. See LICENSE file for details.

---

**Last Updated**: 2026-03-17
**Status**: Production-Ready v1.7
**Maintainer**: hthmkt12
