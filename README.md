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
- **Geo-Routing**: Route visitors to different URLs based on 15 supported countries (US, GB, JP, KR, DE, FR, VN, TH, SG, AU, CA, BR, IN, CN, RU)
- **Bypass URLs**: Optional override URLs for accessing geo-blocked content (priority: bypass_url → target_url → default_url)
- **Click Analytics**: Real-time tracking with 7-day charts, country distribution, referer breakdown, and bot filtering

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
├── pages/               # Route pages (Index, Auth, NotFound)
├── components/          # Reusable UI + business components
│   ├── LinkCard.tsx
│   ├── CreateLinkDialog.tsx
│   ├── EditLinkDialog.tsx
│   ├── StatsPanel.tsx
│   └── ui/             # 45 shadcn/ui components
├── contexts/            # Auth context provider
├── hooks/               # useLinks, useLinkMutations, useMobile
├── lib/                 # Database ops, schemas, types, utilities
├── integrations/        # Supabase client
├── test/                # 37 unit/integration tests
└── App.tsx              # Root component + routing

supabase/
├── functions/redirect/  # Edge function for QR redirects
└── migrations/          # 6 database migrations

proxy-gateway/           # Always-on bypass gateway via HTTP/SOCKS5 proxy vendor
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

---

## Key Commands

```bash
# Development
npm run dev              # Start Vite dev server (http://localhost:5173)
npm run typecheck       # TypeScript type checking
npm run lint            # ESLint code quality

# Testing
npm run test            # Run app test suite (37 Vitest tests)
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

37 app tests covering:
- **Schemas** (17 tests): Zod validation for links, auth, geo routes
- **Database** (11 tests): CRUD operations, short code generation, analytics query helpers
- **Auth Context** (8 tests): Session management, login/logout
- **Sanity Check** (1 test): Base Vitest wiring

Run tests:
```bash
npm run test          # Once
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
- Returns 302 redirect with no-cache headers

### Database Security
- RLS policies on all tables (owner-only for user data)
- Service role used only in edge function (for public INSERT)
- Atomic geo route updates via Postgres RPC function

---

## Known Issues & Roadmap

### Current Issues (Medium Priority)
1. Business components still lack automated tests (`StatsPanel`, `LinkCard`, dialogs, `QRPreview`)
2. Detailed analytics now use server-side aggregate RPCs, but very high-volume or long-range reporting will eventually want pre-aggregated rollups or caching
3. The redirect edge function still relies on manual verification; only the proxy gateway now has automated smoke tests
4. Production build currently emits a large main chunk warning and would benefit from code-splitting

### Planned Features (Q2 2026)
- Link expiration dates
- Password-protected links
- Advanced analytics (date range filtering, exports)
- Team collaboration
- Webhook integrations
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
| Build Time | <30s | ~10s |
| Test Coverage | >80% | 66% (40 tests passing) |
| Uptime | 99.9% | 100% (current) |

---

## Security

- ✅ RLS (Row-Level Security) on all database tables
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

**Last Updated**: 2026-03-16
**Status**: Production-Ready MVP
**Maintainer**: hthmkt12

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
