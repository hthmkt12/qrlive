# QRLive Codebase Summary

**Quick reference guide for developers and LLMs** | Generated from repomix 2026-03-16

---

## Project At a Glance

**QRLive** is a React-based QR code link shortener with:
- Geo-routing to 15 countries
- Bypass URLs for geo-blocking
- Real-time click analytics
- Supabase backend + edge functions
- Vietnamese UI with dark/light themes

**Repository**: https://github.com/hthmkt12/qrlive
**Live**: https://qrlive.vercel.app
**Stack**: React 18 + TypeScript + Vite + Supabase + Edge Functions

---

## Key Stats

| Metric | Value |
|--------|-------|
| **Total Files** | 132 |
| **Repo Tokens** | ~91K |
| **Tests** | 33 passing |
| **Test Coverage** | 66% (schemas, db, auth) |
| **Code Files** | ~50 (src/ + supabase/) |
| **Dependencies** | 24 prod + 13 dev |
| **Build Time** | ~10s |
| **Bundle Size** | ~350KB (gzipped) |

---

## Directory Structure

```
qrlive/
├── src/
│   ├── pages/                 # Route pages (Index, Auth, NotFound)
│   ├── components/            # Reusable UI + 45 shadcn/ui components
│   ├── contexts/              # Auth context provider
│   ├── hooks/                 # React hooks (useLinks, useLinkMutations)
│   ├── lib/                   # Database, schemas, types, utilities
│   ├── integrations/supabase/ # Supabase client & types
│   ├── test/                  # 33 unit/integration tests
│   ├── App.tsx                # Root component + routing
│   ├── main.tsx               # Entry point
│   └── index.css              # Tailwind + global styles
│
├── supabase/
│   ├── functions/redirect/    # Edge function for redirects
│   └── migrations/            # 4 database migrations
│
├── public/                    # Static assets (favicon, robots.txt)
├── .claude/                   # Development context files
├── plans/                     # Development phase docs
├── docs/                      # Documentation (this folder)
├── package.json               # Dependencies & scripts
├── vite.config.ts             # Vite build config
├── vitest.config.ts           # Test config
├── tailwind.config.ts         # Tailwind CSS
├── tsconfig.json              # TypeScript
├── .env.example               # Environment template
└── README.md                  # Project overview
```

---

## Core Components

### Pages (src/pages/)
- **Index.tsx** — Dashboard (protected, lists QR links + analytics)
- **Auth.tsx** — Login/signup form
- **NotFound.tsx** — 404 fallback

### Business Components (src/components/)
- **LinkCard.tsx** — Displays single QR link with actions
- **CreateLinkDialog.tsx** — Modal form to create new link
- **EditLinkDialog.tsx** — Modal form to edit existing link
- **StatsPanel.tsx** — Analytics: 7-day chart, country pie, referer list
- **QRPreview.tsx** — Renders QR code for short URL

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
Fetches all links with relations (geo_routes, click_events).

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
short_code TEXT UNIQUE  -- 6-char alphanumeric
default_url TEXT
is_active BOOLEAN
created_at TIMESTAMP
updated_at TIMESTAMP

RLS: owner-only (SELECT, INSERT, UPDATE, DELETE)
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
referer TEXT
created_at TIMESTAMP

RLS: Public INSERT, owner SELECT
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
links: {
  all: ["links"],
  list: () => ["links", "list"],
  detail: (id) => ["links", "list", { id }],
}
```

### Mutations Auto-Refetch
Create/update/delete mutations trigger `queryClient.invalidateQueries(links.all)`.

---

## Edge Function: redirect/{shortCode}

**Path**: supabase/functions/redirect/index.ts
**Runtime**: Deno
**Access**: Service role (bypasses RLS)

**Flow**:
1. Validate short code (^[A-Z0-9]{6}$)
2. Fetch link + geo_routes (service role)
3. Extract geo data: country (cf-ipcountry), IP, user-agent, referer
4. Check bot pattern (skip recording for crawlers)
5. Rate limit check (1 click/IP/60s)
6. Record click if pass all checks
7. Resolve redirect: bypass_url → target_url → default_url
8. Validate protocol (^https?://)
9. Return 302 + no-store cache headers

**Key Details**:
- Geo detection: Cloudflare header only (local dev: manual header)
- Bot pattern: `/bot|crawler|spider|prerender|headless|facebookexternalhit|twitterbot|slurp/i`
- Rate limiting: Query last 60s, skip if count > 0
- CORS: Enabled for all origins

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

---

## Testing (33 tests)

### Schemas (17 tests)
- Valid/invalid link forms
- Valid/invalid auth credentials
- URL validation (protocol, format)
- Geo route validation

### Database (7 tests)
- Fetch links
- Generate short code (collision)
- Create/update/delete link
- Insert geo routes

### Auth Context (8 tests)
- Initial loading state
- Session initialization
- Auth event subscription
- Sign in/up/out

**Run Tests**:
```bash
npm run test          # Run once
npm run test:watch   # Watch mode
```

---

## Build & Deploy

### Development
```bash
npm install
npm run dev           # Vite dev server (http://localhost:5173)
npm run typecheck    # TypeScript check
npm run lint         # ESLint
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
| **src/lib/db.ts** | Supabase queries (fetch, create, update, delete) |
| **src/lib/schemas.ts** | Zod validation schemas (centralized) |
| **src/lib/types.ts** | COUNTRIES list, TypeScript types |
| **src/contexts/auth-context.tsx** | Auth state + methods (useAuth hook) |
| **src/hooks/use-links.ts** | React Query: fetch links |
| **src/hooks/use-link-mutations.ts** | React Query: mutations with refetch |
| **src/components/Index.tsx** | Dashboard (main page) |
| **src/components/LinkCard.tsx** | Link display + actions |
| **src/components/CreateLinkDialog.tsx** | Create form modal |
| **src/components/EditLinkDialog.tsx** | Edit form modal |
| **src/components/StatsPanel.tsx** | Analytics visualization |
| **supabase/functions/redirect/index.ts** | Redirect edge function |

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
- **Bundle size**: ~350KB gzipped
- **React Query caching**: Immediate refetch on mutation

---

## Security Notes

- ✅ RLS on all tables (owner-only)
- ✅ Auth context always resolves loading state
- ✅ URL protocol validation (block javascript:, data:)
- ✅ Rate limiting (1 click/IP/60s)
- ✅ Bot filtering (crawlers don't count)
- ✅ CORS headers on edge function
- ⚠️ Non-null assertion on `user!.id` (should be optional check)
- ⚠️ React keys using country_code (should use unique id)

---

## Known Issues

| Issue | Severity | Fix Time | Status |
|-------|----------|----------|--------|
| React key uses country_code | Low | 10min | Pending |
| Non-null assertion on user.id | Low | 10min | Pending |
| 0% component test coverage | Medium | 2-3 hours | Pending |
| refetchInterval 10s (DB load) | Low | 15min | Pending |

---

## Useful Commands

```bash
# Development
npm run dev              # Start dev server
npm run typecheck       # Type check
npm run lint            # Lint code

# Testing
npm run test            # Run tests once
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

**Last Updated**: 2026-03-16
**Next Review**: 2026-04-16
