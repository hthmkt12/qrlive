# System Architecture

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (React)                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Dashboard (Index.tsx)                                    │  │
│  │ ├─ LinkCard (list of QR links)                          │  │
│  │ ├─ CreateLinkDialog                                      │  │
│  │ ├─ EditLinkDialog                                        │  │
│  │ └─ StatsPanel (analytics visualization)                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                      ↓                                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ React Query (TanStack) — State Management                │  │
│  │ ├─ useLinks (fetch links)                                │  │
│  │ ├─ useLinkMutations (create/edit/delete)                 │  │
│  │ └─ Cache invalidation on mutation                        │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│           Supabase (Backend as a Service)                       │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Postgres Database (with RLS)                             │  │
│  │ ├─ qr_links (owner-only SELECT/INSERT/UPDATE/DELETE)    │  │
│  │ ├─ geo_routes (inherited RLS via link)                   │  │
│  │ └─ click_events (public INSERT, owner-only SELECT)      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Auth (Built-in JWT)                                      │  │
│  │ ├─ signup (email/password)                               │  │
│  │ ├─ login (return session token)                          │  │
│  │ └─ refresh (auto-renew on request)                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Edge Functions (Deno Runtime)                            │  │
│  │ └─ /functions/v1/redirect/{shortCode}                   │  │
│  │    ├─ Validate short code                                │  │
│  │    ├─ Geo-detect (cf-ipcountry header)                  │  │
│  │    ├─ Rate limit check (1 click/IP/60s)                │  │
│  │    ├─ Bot filter                                         │  │
│  │    ├─ Record click event                                 │  │
│  │    ├─ Resolve target (bypass → target → default)        │  │
│  │    └─ Return 302 redirect                                │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### 1. Create QR Link Flow

```
User Input (name, defaultUrl, geoRoutes)
         ↓
react-hook-form validates (zod schema)
         ↓
CreateLinkDialog.tsx → useLinkMutations.createLink()
         ↓
db.ts: createLinkInDB()
  ├─ optional customShortCode OR generateShortCode() [6-char fallback]
  ├─ INSERT qr_links
  └─ INSERT geo_routes (if provided)
         ↓
React Query refetch → update dashboard
         ↓
toast.success("Link created")
```

### 2. Redirect & Analytics Flow

```
User clicks QR code (or visits short URL)
         ↓
GET /functions/v1/redirect/{shortCode}
         ↓
Edge Function (redirect/index.ts):
  ├─ Validate short code format (^[A-Z0-9_-]{3,20}$)
  ├─ Fetch link + geo_routes (service role, bypasses RLS)
  ├─ Extract geo info:
  │  ├─ Country from cf-ipcountry header (Cloudflare)
  │  ├─ IP from x-forwarded-for / cf-connecting-ip
  │  ├─ User-Agent from request
  │  └─ Referer from request
  ├─ Check if bot (BOT_PATTERN regex)
  ├─ If real user:
  │  ├─ Rate limit check (1 click/IP/60s)
  │  └─ INSERT click_events (if pass)
  ├─ Resolve redirect:
  │  ├─ If country route exists AND bypass_url set → use bypass_url
  │  ├─ Else if country route exists → use target_url
  │  └─ Else → use default_url
  ├─ Validate protocol (block javascript:, data:)
  └─ Return 302 + Cache-Control: no-store
         ↓
Browser follows redirect to target
         ↓
Click recorded in analytics (visible in dashboard)
```

### 3. Edit Geo Routes Flow

```
User modifies geo routes in EditLinkDialog
         ↓
react-hook-form validates
         ↓
useLinkMutations.updateGeoRoutes()
         ↓
db.ts: updateGeoRoutesInDB()
  ├─ Call Postgres RPC: upsert_geo_routes()
  │  ├─ DELETE old geo_routes WHERE link_id = {id}
  │  └─ INSERT new geo_routes (atomic transaction)
  └─ (ensures no partial state on failure)
         ↓
React Query refetch
         ↓
Dashboard updates immediately
```

---

## Database Schema

### qr_links
```sql
CREATE TABLE qr_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  short_code TEXT NOT NULL UNIQUE,  -- auto-generated 6-char or custom 3-20 chars
  default_url TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- RLS Policy: SELECT/INSERT/UPDATE/DELETE only own records
CREATE POLICY "owner_select" ON qr_links
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "owner_insert" ON qr_links
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner_update" ON qr_links
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "owner_delete" ON qr_links
  FOR DELETE USING (auth.uid() = user_id);
```

### geo_routes
```sql
CREATE TABLE geo_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID NOT NULL REFERENCES qr_links(id) ON DELETE CASCADE,
  country TEXT NOT NULL,          -- e.g., "United States"
  country_code TEXT NOT NULL,     -- e.g., "US"
  target_url TEXT NOT NULL,
  bypass_url TEXT,                -- Optional, for geo-block evasion
  UNIQUE(link_id, country_code)
);

-- RLS: Inherit via link_id → qr_links → owner_id
-- (Edge function uses service role for inserts)
```

### click_events
```sql
CREATE TABLE click_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID NOT NULL REFERENCES qr_links(id) ON DELETE CASCADE,
  country TEXT,
  country_code TEXT,
  ip_address TEXT,
  user_agent TEXT,
  referer TEXT (≤500 chars),
  created_at TIMESTAMP DEFAULT now()
);

-- RLS: Service role INSERT only (via edge function)
-- RLS: Owner SELECT (user_id derived from link_id)
-- NOTE: Dropped click_events_insert_public policy — anon clients cannot INSERT
CREATE POLICY "owner_select" ON click_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM qr_links
      WHERE qr_links.id = click_events.link_id
      AND auth.uid() = qr_links.user_id
    )
  );
```

---

## Authentication & Authorization

### Auth Flow

```
1. User visits /auth
2. signUp / signIn via Supabase Auth
   - Email/password hashed in Supabase
   - Returns JWT token (session)
3. Token stored in localStorage (Supabase client auto-manages)
4. Protected routes check useAuth() hook
   - If !user → redirect to /auth
   - If loading → render null (wait for auth resolution)
5. Every API call includes Authorization header (Supabase auto-attaches)
6. RLS policies check auth.uid() on every query
```

### RLS Enforcement

- **qr_links**: Rows only visible/modifiable by owner (user_id = auth.uid())
- **geo_routes**: Inherited access via qr_links CASCADE
- **click_events**: Public INSERT (edge function uses service role), owner-only SELECT

**Edge Function Exception**: Uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS for:
- Fetching qr_links by short_code (public lookup needed)
- Inserting click_events (anonymous redirect needs write access, anon client cannot INSERT anymore)

---

## Component Architecture

### Pages
| Page | Purpose |
|------|---------|
| `Index.tsx` | Dashboard: list links, create/edit/delete UI |
| `Auth.tsx` | Login/signup form (AuthInput schema) |
| `NotFound.tsx` | 404 catch-all |

### Custom Components
| Component | Purpose |
|-----------|---------|
| `LinkCard.tsx` | Display single link (name, short code, QR) + actions |
| `CreateLinkDialog.tsx` | Modal form to create link with geo routes |
| `EditLinkDialog.tsx` | Modal form to edit existing link |
| `StatsPanel.tsx` | Analytics: bar chart (7-day), pie chart (countries), referer list |
| `QRPreview.tsx` | Render QR code for short link |

### UI Components (shadcn/ui)
45 Radix UI components wrapped with Tailwind CSS:
- Forms: Input, Textarea, Select, Checkbox, RadioGroup, Toggle, Slider
- Layout: Card, Dialog, Sheet, Drawer, Popover, Tooltip, Sidebar
- Display: Badge, Alert, Accordion, Tabs, Table, Carousel
- Feedback: Toast, AlertDialog, HoverCard, ContextMenu

---

## State Management

### React Query (TanStack v5)

**Query Key Hierarchy**:
```typescript
// query-keys.ts
links: ["links"]
link: (id) => ["links", id]
analytics: {
  all: ["links", "analytics"],
  summaries: (linkIds) => ["links", "analytics", "summaries", ...linkIds],
  detail: (id) => ["links", "analytics", "detail", id],
}
```

**Hooks**:
- `useLinks()` — Fetch links + geo_routes only
- `useLinkAnalyticsSummaries()` — Fetch aggregate totals for dashboard cards and link cards
- `useLinkAnalyticsDetail()` — Fetch aggregate 7-day/country/referer detail for the selected link
- `useLinkMutations()` — Create/update/delete mutations with automatic refetch

---

## Form Validation

### Zod Schemas (lib/schemas.ts)

```typescript
// Geo route validation
geoRouteSchema = z.object({
  country: z.string(),
  countryCode: z.string().min(2, "Chọn quốc gia"),
  targetUrl: z.string().url("URL không hợp lệ"),
  bypassUrl: z.union([z.string().url(), z.literal("")]).optional(),
});

// Link form validation
linkFormSchema = z.object({
  name: z.string().min(1, "Tên không được để trống").max(100),
  defaultUrl: z.string().url("URL mặc định không hợp lệ"),
  geoRoutes: z.array(geoRouteSchema).default([]),
});

// Auth form validation
authSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự"),
});
```

All error messages are in Vietnamese.

---

## Edge Function Deep Dive: `redirect/{shortCode}`

**Deployed to**: Supabase Edge Functions (Deno runtime)
**Runtime**: Deno
**Auth**: Uses SUPABASE_SERVICE_ROLE_KEY (bypass RLS)

**Request Headers Used**:
- `cf-ipcountry` — Cloudflare geo-detection (e.g., "US")
- `x-forwarded-for` — Client IP (fallback: cf-connecting-ip)
- `user-agent` — Browser/crawler detection
- `referer` — Traffic source (truncated ≤500 chars before storing)

**Rate Limiting Strategy**:
```typescript
const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
const { count } = await supabase
  .from("click_events")
  .select("id", { count: "exact", head: true })
  .eq("link_id", link.id)
  .eq("ip_address", ip)
  .gte("created_at", oneMinuteAgo);

if (count === 0) { // Record click only if no recent click from this IP
  await supabase.from("click_events").insert({...});
}
```

**Bot Filtering**:
```typescript
const BOT_PATTERN = /bot|crawler|spider|prerender|headless|facebookexternalhit|twitterbot|slurp/i;
if (!BOT_PATTERN.test(userAgent)) {
  // Record click
}
```

**URL Resolution Priority**:
```
1. Country matches geo_route AND bypass_url is set
   → Use bypass_url
2. Country matches geo_route
   → Use target_url
3. Default
   → Use default_url
```

**Security Checks**:
- Short code format: auto `^[A-Z0-9]{6}$` OR custom `^[A-Z0-9_-]{3,20}$` (validated in db.ts before INSERT)
- Custom code collision detection (try-catch on UNIQUE constraint)
- Redirect target protocol: `^https?://` (block javascript:, data:)
- SSRF guard in proxy function: blocks localhost, 10.x, 172.16-31.x, 192.168.x, 169.254.x
- Response headers: `Cache-Control: no-store`, `X-Robots-Tag: noindex`

---

### Proxy Infrastructure

Three paths handle cross-border access for QR scans and destination content:

| Path | Role | Canonical? |
|---|---|---|
| `cloudflare-worker/redirect-proxy.js` | **Redirect-domain gateway** — routes `r.yourdomain.com/CODE` → Supabase redirect edge function, preserving `cf-ipcountry` and all request headers. | ✅ Yes — production redirect layer |
| `proxy-gateway/` | **Destination-content bypass** — always-on Node.js service (Fly.io Tokyo) that forwards `bypass_url` traffic to `UPSTREAM_ORIGIN` via optional HTTP/SOCKS5 vendor proxy, rewrites `Location` headers. | ✅ Yes — production bypass layer |
| `supabase/functions/proxy/index.ts` | **Content-fetch proxy** — same bypass intent but runs on Supabase Edge; `supabase.co` may itself be blocked by GFW. | ❌ Fallback/testing only |

```
QR scan flow (CN):
  Phone → r.yourdomain.com/CODE          (cloudflare-worker)
    → supabase.co/functions/v1/redirect   (redirect edge function)
      → geo_route for CN → bypass_url     (geo-routing)
        → jp.yourdomain.com/page          (proxy-gateway on Fly.io)
          → origin server                 (via vendor proxy)
```

## Performance & Optimization

| Area | Strategy | Result |
|------|----------|--------|
| **Redirect Latency** | Edge function (Deno, runs on Cloudflare) | <100ms |
| **React Query** | 30s staleTime + invalidation on mutations | Data freshness |
| **Component Rendering** | React Query cache + Framer Motion | Smooth animations |
| **Database** | Postgres indexes on user_id, short_code | Fast lookups |
| **UI State** | Loading skeletons on LinkCard | No layout shift |

---

## Deployment Architecture

```
┌─────────────────────────────────────────┐
│ GitHub (hthmkt12/qrlive)                │
│ ├─ Push to main                         │
│ └─ Trigger CI/CD                        │
└──────────────┬──────────────────────────┘
               ↓
┌──────────────────────────┐    ┌──────────────────────┐
│ Vercel (Frontend)        │    │ Supabase (Backend)   │
│ ├─ Build: npm run build  │    │ ├─ Postgres DB      │
│ ├─ Deploy to CDN         │    │ ├─ Auth             │
│ ├─ Auto-revert on error  │    │ ├─ Edge Functions   │
│ └─ Env: VITE_SUPABASE_*  │    │ └─ RLS Policies     │
└──────────────────────────┘    └──────────────────────┘
```

---

## Error Handling

### Edge Function Errors

| Status | Scenario |
|--------|----------|
| 400 | Invalid short code format or invalid redirect target |
| 404 | Link not found or inactive |
| 500 | Database error or unexpected exception |

All responses include CORS headers for browser access.

### Frontend Error Handling
- React Query retry logic (3 attempts on network failure)
- Toast notifications (sonner) on mutation error
- Auth context always resolves loading state (even on error)
- Error boundaries could be added (currently no fallback UI)

---

## Key Migrations

| Migration | Date | Change |
|-----------|------|--------|
| Initial schema | 2026-03-15 | qr_links, geo_routes, click_events + RLS |
| Auth + RLS | 2026-03-15 | Add user_id FK, RLS policies |
| Bypass URL | 2026-03-15 | Add bypass_url column to geo_routes |
| Atomic geo update | 2026-03-16 | Add upsert_geo_routes() RPC function |
| Analytics summaries RPC | 2026-03-16 | Add get_link_click_summaries(uuid[]) aggregate function |
| Analytics detail RPC | 2026-03-16 | Add get_link_click_detail(uuid) aggregate function |
| Click events restrict | 2026-03-16 | Drop click_events_insert_public policy; service role only |

---

## Monitoring & Debugging

**No current monitoring** (nice-to-have):
- Error tracking (Sentry)
- Performance monitoring (Datadog)
- Log aggregation (ELK stack)
- Analytics dashboard (Metabase)

**Local debugging**:
- `npm run dev` — Vite dev server with HMR
- `supabase start` — Local Postgres + Auth + Edge Functions
- Browser DevTools → Network/Console for redirect issues
- `supabase functions serve` — Debug edge function locally
