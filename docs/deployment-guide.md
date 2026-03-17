# Deployment Guide

---

## Prerequisites

- Node.js 18+ (check: `node --version`)
- npm 9+ (check: `npm --version`)
- Supabase CLI (install: `npm install -g supabase`)
- GitHub account with repository access
- Vercel account (https://vercel.com)
- Supabase project created (https://supabase.com)

---

## Architecture Overview

```
┌─────────────────────────┐
│ GitHub Repository       │
│ (hthmkt12/qrlive)       │
└────────────┬────────────┘
             │ Push to main
             ↓
┌──────────────────────────────────┐    ┌──────────────────────┐
│ Vercel (Frontend)                │    │ Supabase (Backend)   │
│ ├─ Auto-build on push            │    │ ├─ Postgres DB       │
│ ├─ Deploy to CDN                 │    │ ├─ Auth              │
│ ├─ Env: VITE_SUPABASE_*          │    │ ├─ Edge Functions    │
│ └─ URL: qrlive.vercel.app        │    │ ├─ RLS Policies      │
│                                  │    │ └─ Project ID:       │
│                                  │    │    ybxmpuirarncxmenprzf
└──────────────────────────────────┘    └──────────────────────┘
```

---

## Step 1: Local Setup

### Clone Repository
```bash
git clone https://github.com/hthmkt12/qrlive.git
cd qrlive
```

### Install Dependencies
```bash
npm install
```

### Create `.env.local`
Copy `.env.example` and fill in Supabase credentials:
```bash
cp .env.example .env.local
```

**Fill in these values**:
```
VITE_SUPABASE_URL=https://ybxmpuirarncxmenprzf.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<get from Supabase dashboard>
```

**Where to find credentials**:
1. Open Supabase dashboard: https://app.supabase.com/projects
2. Select project `ybxmpuirarncxmenprzf`
3. Settings → API → URL (copy VITE_SUPABASE_URL)
4. Settings → API → Publishable Key (anon key, copy VITE_SUPABASE_PUBLISHABLE_KEY)

### Verify Local Development
```bash
npm run dev
# Open http://localhost:5173
```

---

## Step 2: Database Setup (First-Time Only)

### Start Local Supabase
```bash
supabase start
```

This starts:
- Local Postgres on port 54322
- Local Auth service
- Local Edge Functions

### Apply Migrations
Migrations run automatically when `supabase start` is called.

**Manual migration** (if needed):
```bash
supabase db push
```

**Verify schema**:
```bash
supabase db list tables
```

Expected tables: `qr_links`, `geo_routes`, `click_events`

### View Local Database
```bash
# Connect via psql
supabase db inspect

# Or use Supabase Studio GUI (opens at http://localhost:54323)
```

---

## Step 3: Edge Function Setup

### Deploy Redirect Function to Local
```bash
supabase functions serve redirect
```

This starts the edge function locally at: `http://localhost:54321/functions/v1/redirect`

### Test Redirect Function (Local)
```bash
# Create a test link manually in Supabase Studio first
# Then test redirect:
curl -i "http://localhost:54321/functions/v1/redirect/ABC123" \
  -H "cf-ipcountry: US"
```

### Deploy to Production (Supabase)

**First-time deployment**:
```bash
# Link to Supabase project
supabase link --project-ref ybxmpuirarncxmenprzf

# Deploy function (with no-verify-jwt flag)
supabase functions deploy redirect --no-verify-jwt
```

**Verify deployment**:
```bash
supabase functions list
# Should show: redirect ✓
```

**Test production function**:
```bash
# Get your Supabase URL and short code
curl -i "https://ybxmpuirarncxmenprzf.supabase.co/functions/v1/redirect/ABC123" \
  -H "cf-ipcountry: US"
```

---

## Step 4: Environment Variables Setup

### For Development (`.env.local`)
```
VITE_SUPABASE_URL=https://ybxmpuirarncxmenprzf.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
```

### For Vercel (Production)
1. Go to Vercel: https://vercel.com/dashboard
2. Select QRLive project
3. Settings → Environment Variables
4. Add these variables:
   - **Name**: `VITE_SUPABASE_URL`
     **Value**: `https://ybxmpuirarncxmenprzf.supabase.co`
   - **Name**: `VITE_SUPABASE_PUBLISHABLE_KEY`
     **Value**: `eyJ...` (copy from Supabase dashboard)

**Environments to set for**:
- Production
- Preview
- Development

### For GitHub Actions PR CI
Add these repository secrets in GitHub → Settings → Secrets and variables → Actions:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `E2E_TEST_EMAIL`
- `E2E_TEST_PASSWORD`

The Playwright PR job only runs when all four secrets are present. This keeps fork PRs from failing because protected secrets are unavailable.

---

## Step 5: Frontend Deployment (Vercel)

### Connect GitHub to Vercel
1. Go to https://vercel.com/new
2. Import GitHub repository: `hthmkt12/qrlive`
3. Select framework: **Vite**
4. Build command: `npm run build` (auto-detected)
5. Install command: `npm install`
6. Output directory: `dist` (auto-detected)

### Configure Vercel Project
1. Environment variables (from Step 4)
2. Domains: Add custom domain or use `qrlive.vercel.app` (auto-generated)
3. Git configuration:
   - Production branch: `main`
   - Auto-deploy on push: ✓ enabled

### Deploy
```bash
# Option 1: Manual via Vercel CLI
vercel --prod

# Option 2: Auto-deploy (push to GitHub)
git push origin main
# Vercel automatically builds and deploys
```

### Verify Deployment
- URL: https://qrlive.vercel.app
- Check logs: https://vercel.com/dashboard → QRLive → Deployments

---

## Step 6: Database Configuration

### Enable RLS (Row-Level Security)

RLS should already be enabled from migrations, but verify:

1. Supabase dashboard → SQL Editor
2. Run:
```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables
WHERE tablename IN ('qr_links', 'geo_routes', 'click_events');
-- Should show: rowsecurity = true
```

### Verify RLS Policies

1. Supabase dashboard → Authentication → Policies
2. For each table, verify these policies exist:

**qr_links**:
- `owner_select` — SELECT WHERE auth.uid() = user_id
- `owner_insert` — INSERT WHERE auth.uid() = user_id
- `owner_update` — UPDATE WHERE auth.uid() = user_id
- `owner_delete` — DELETE WHERE auth.uid() = user_id

**click_events**:
- `allow_public_insert` — INSERT (public, for edge function)
- `owner_select` — SELECT (via link ownership)

### Create Postgres RPC Function (upsert_geo_routes)

This function is defined in migration `20260316003432_atomic_geo_routes_update.sql`.

**Verify it exists**:
```sql
SELECT proname FROM pg_proc WHERE proname = 'upsert_geo_routes';
-- Should return: upsert_geo_routes
```

If missing, apply migration manually:
```bash
supabase db push migrations/20260316003432_atomic_geo_routes_update.sql
```

---

## Step 7: Edge Function Secrets

### Set SERVICE_ROLE_KEY (Edge Function)

Edge function needs `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS.

1. Supabase dashboard → Settings → API
2. Copy **Service Role Secret Key**
3. Add to Supabase Edge Function secrets:
```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY "your-service-role-key"
```

4. Verify secret is set:
```bash
supabase secrets list
```

### Verify Edge Function Access

Test that edge function can insert click_events:
```bash
curl -X POST "https://ybxmpuirarncxmenprzf.supabase.co/functions/v1/redirect/ABC123" \
  -H "cf-ipcountry: US" \
  -H "Content-Type: application/json"
# Should return 302 or 404 (not 401 Unauthorized)
```

---

## Step 8: Authentication Setup

### Supabase Auth Configuration

**Email/Password Auth** (should be auto-enabled):
1. Supabase dashboard → Authentication → Providers
2. **Email** provider: Should show "Enabled"

### Auth Redirect URLs

Configure allowed redirect URLs (for OAuth/email links):
1. Supabase dashboard → Authentication → URL Configuration
2. Add:
   - **Site URL**: `https://qrlive.vercel.app`
   - **Redirect URLs**:
     ```
     https://qrlive.vercel.app/auth
     https://qrlive.vercel.app/
     localhost:5173
     localhost:3000
     ```

### Test Auth Flow
1. Visit https://qrlive.vercel.app
2. Sign up: `test@example.com` / password
3. Receive confirmation email (if email confirmation enabled)
4. Log in
5. Should redirect to dashboard

---

## Step 9: Database Indexing (Performance)

Create indexes for common queries:

```sql
-- Index on user_id (critical for RLS filtering)
CREATE INDEX IF NOT EXISTS idx_qr_links_user_id ON qr_links(user_id);

-- Index on short_code (lookup in redirect function)
CREATE INDEX IF NOT EXISTS idx_qr_links_short_code ON qr_links(short_code);

-- Index on created_at (order by in dashboard)
CREATE INDEX IF NOT EXISTS idx_qr_links_created_at ON qr_links(created_at DESC);

-- Index on link_id (foreign key)
CREATE INDEX IF NOT EXISTS idx_geo_routes_link_id ON geo_routes(link_id);
CREATE INDEX IF NOT EXISTS idx_click_events_link_id ON click_events(link_id);

-- Index for rate limiting (by IP and timestamp)
CREATE INDEX IF NOT EXISTS idx_click_events_ip_created
  ON click_events(ip_address, created_at DESC);
```

Run in Supabase SQL Editor.

---

## Monitoring & Debugging

### View Production Logs

**Edge Function Logs**:
```bash
supabase functions logs redirect
# Or via Supabase dashboard → Edge Functions → redirect → Logs
```

**Browser Console** (test the app):
1. Open https://qrlive.vercel.app
2. DevTools → Console
3. Check for errors during redirect test

### Database Query Logs

```bash
# View recent queries (PostgreSQL logs)
supabase db logs --type postgres
```

### Error Tracking

**No error tracking configured** (nice-to-have):
- Sentry (error tracking)
- Datadog (performance monitoring)
- LogRocket (session replay)

### Testing Redirect Function

**Local test**:
```bash
# With local Supabase running:
curl -i "http://localhost:54321/functions/v1/redirect/ABC123" \
  -H "cf-ipcountry: US"
```

**Production test**:
```bash
# Get a real short code from your dashboard first:
curl -i "https://ybxmpuirarncxmenprzf.supabase.co/functions/v1/redirect/{SHORT_CODE}" \
  -H "cf-ipcountry: US"
# Should return 302 with Location header
```

---

## Troubleshooting

### Issue: "VITE_SUPABASE_URL not found"
**Solution**:
- Check `.env.local` exists and has correct keys
- Restart dev server: `npm run dev`
- Vercel: Check Environment Variables in project settings

### Issue: "Function returned 401 Unauthorized"
**Solution**:
- Edge function lacks SUPABASE_SERVICE_ROLE_KEY
- Run: `supabase secrets set SUPABASE_SERVICE_ROLE_KEY "<key>"`
- Redeploy: `supabase functions deploy redirect --no-verify-jwt`

### Issue: "RLS policy violation"
**Solution**:
- Check if INSERT click_events has public policy
- Verify `allow_public_insert` policy exists on click_events
- Edge function must use SERVICE_ROLE_KEY (not anon key)

### Issue: "401 in Vercel deployment but works locally"
**Solution**:
- Environment variables not set in Vercel
- Check: Vercel project → Settings → Environment Variables
- Verify both VITE_SUPABASE_* variables are set for Production

### Issue: "Database connection refused"
**Solution**:
- For local: Run `supabase start` first
- For production: Check Supabase project status (https://app.supabase.com)
- Check if IP is in Supabase whitelist (if applicable)

### Issue: "Redirect returns 404 Not Found"
**Solution**:
- Short code doesn't exist or is inactive
- Check dashboard to verify link was created
- Short code is case-sensitive (must be UPPERCASE)
- Link's is_active must be true

### Issue: "Geo detection not working"
**Solution**:
- cf-ipcountry header only available on Cloudflare CDN (Vercel uses Cloudflare)
- Local testing: Manually add header: `-H "cf-ipcountry: US"`
- If empty, visitor falls back to default_url (expected behavior)

---

## Deployment Checklist

- [ ] Repository created on GitHub (hthmkt12/qrlive)
- [ ] Supabase project created (ybxmpuirarncxmenprzf)
- [ ] Local `.env.local` configured with Supabase credentials
- [ ] Migrations applied (supabase db push)
- [ ] RLS policies verified
- [ ] Edge function deployed (supabase functions deploy redirect --no-verify-jwt)
- [ ] Edge function secrets set (SUPABASE_SERVICE_ROLE_KEY)
- [ ] Vercel project created and linked to GitHub
- [ ] Vercel environment variables set (VITE_SUPABASE_*)
- [ ] Production domain configured (qrlive.vercel.app)
- [ ] Auth redirect URLs configured in Supabase
- [ ] Database indexes created
- [ ] Test signup/login flow
- [ ] Test QR code redirect
- [ ] Test analytics dashboard

---

## Post-Deployment

### Monitor Performance
- Check Vercel analytics: https://vercel.com/dashboard
- Check Supabase usage: https://app.supabase.com → Usage

### Regular Maintenance
- Review Edge Function logs weekly
- Monitor database size
- Backup sensitive data periodically
- Update dependencies: `npm outdated`

### Scaling Considerations
- Database: Add read replicas for heavy analytics queries
- Edge Functions: Increase memory allocation if timeouts occur
- CDN: Vercel handles caching; consider cache headers for assets

---

## Rollback Procedure

### If Frontend Deployment Fails
1. Go to Vercel: https://vercel.com/dashboard
2. Select QRLive project
3. Deployments tab → Find last working deployment
4. Click → Promote to Production

### If Edge Function Breaks
```bash
# Redeploy from backup (or revert code in git)
git revert <last-commit>
supabase functions deploy redirect --no-verify-jwt
```

### If Database Migration Fails
```bash
# Rollback last migration
supabase db reset
# Then re-apply correct migrations
supabase db push
```

---

## Security Checklist

- [ ] SERVICE_ROLE_KEY never committed to git
- [ ] .env files in .gitignore
- [ ] RLS policies enforce user data isolation
- [ ] Edge function validates short code format
- [ ] Edge function blocks javascript: and data: URLs
- [ ] Rate limiting enabled (1 click/IP/60s)
- [ ] CORS headers configured on edge function
- [ ] Session persistence behavior verified (`localStorage` in current Supabase client config)
- [ ] Database backups enabled (Supabase default)

---

## China Accessibility (Custom Redirect Domain)

QR codes mặc định trỏ đến `supabase.co` — có thể bị block bởi Great Firewall (GFW).
Để phục vụ khách Trung Quốc, cấu hình custom domain accessible từ TQ.

### Cách hoạt động

```
QR Code → r.yourdomain.com/CODE   ← custom domain (accessible từ TQ)
               ↓ proxy
          supabase.co/functions/v1/redirect/CODE
               ↓ geo-routing
          Target URL
```

Proxy **phải forward `cf-ipcountry` header** để geo-routing tiếp tục hoạt động đúng.

### Option A: Cloudflare Workers (miễn phí, không guaranteed ở TQ ~70%)

```bash
# 1. Edit cloudflare-worker/redirect-proxy.js — set env var SUPABASE_REDIRECT_URL
# 2. Deploy
npm install -g wrangler
wrangler login
wrangler deploy cloudflare-worker/redirect-proxy.js \
  --name qrlive-redirect \
  --route "r.yourdomain.com/*"

# 3. Set secrets in Wrangler
wrangler secret put SUPABASE_REDIRECT_URL
# Paste: https://ybxmpuirarncxmenprzf.supabase.co/functions/v1/redirect

# 4. Set env var trong Vercel
VITE_REDIRECT_BASE_URL=https://r.yourdomain.com
```

**Note**: Cloudflare Worker hardcoded redirect URL removed; now uses `env.SUPABASE_REDIRECT_URL` for flexibility.

### Option B: Alibaba Cloud Function Compute (100% accessible từ TQ)

1. Tạo Function Compute tại [Alibaba Cloud](https://www.alibabacloud.com/product/function-compute)
2. Deploy code tương tự `cloudflare-worker/redirect-proxy.js` (Node.js handler)
3. Bind custom domain tại Alibaba → gán vào function
4. Set `VITE_REDIRECT_BASE_URL=https://r.yourdomain.com` trong Vercel + redeploy

### Option C: Hong Kong VPS (~$5/tháng, reliable nhất)

```nginx
# nginx config trên HK VPS
server {
  listen 80;
  server_name r.yourdomain.com;

  location ~ ^/(.+)$ {
    proxy_pass https://YOUR_PROJECT.supabase.co/functions/v1/redirect/$1;
    proxy_set_header cf-ipcountry $http_cf_ipcountry;
    proxy_set_header User-Agent $http_user_agent;
  }
}
```

### Test GFW blocking

- [blockedinchina.net](https://www.blockedinchina.net) — kiểm tra URL bị block không
- Ping từ HK VPS để verify connectivity đến Supabase

---

## Legacy Japan Proxy Server (China GFW — Content Bypass)

For QR links where the **destination website** is blocked by GFW (not just the redirect URL):

### How It Works

```
CN user scans QR
  → Cloudflare Worker → Supabase redirect edge function
    → geo_route for CN → bypass_url = https://jp.company.com/page
      → Japan nginx reverse proxy (Tokyo VPS)
        → actual origin server (www.company.com)
```

The `bypass_url` field in each CN geo-route points to the Japan proxy. No QRLive code changes needed — `bypass_url` is already supported.
Use this only if you intentionally want to operate your own nginx reverse proxy instead of the newer `proxy-gateway` service.

### Setup (Japan VPS — Recommended)

```bash
# 1. Provision Tokyo VPS (~$5-6/mo: Vultr, Linode, AWS Lightsail ap-northeast-1)
# 2. Copy japan-proxy/ to VPS, then run:
bash setup.sh jp.company.com admin@company.com

# 3. Edit nginx site config — set proxy_pass to your origin:
vim japan-proxy/nginx/conf.d/proxy-jp-company-com.conf
# Change: proxy_pass https://www.company.com;
#    And: proxy_set_header Host www.company.com;

# 4. Restart nginx
docker compose restart nginx

# 5. Verify
curl -sf https://jp.company.com/health
```

### Configure bypass_url in QRLive

1. Dashboard → edit QR link → geo-routes section
2. Add CN (China) row:
   - **Target URL**: `https://www.company.com/page` (original)
   - **Bypass URL**: `https://jp.company.com/page` (Japan proxy)
3. Save → test end-to-end using a real CN VPN or China-based device.
   > ⚠️ **Do NOT use `curl -H "cf-ipcountry: CN"`** as a production test — it bypasses the Cloudflare Worker entirely and tests a shortcut that skips geo-routing.

### Alternative: Supabase Edge Function Proxy (Zero-Infra, Testing Only)

```bash
# Deploy
supabase secrets set PROXY_SECRET=your-random-secret
supabase secrets set PROXY_ALLOWED_HOSTS=www.company.com
supabase functions deploy proxy --no-verify-jwt

# bypass_url format:
# https://PROJECT.supabase.co/functions/v1/proxy?url=https://www.company.com/page&key=SECRET
```

**Warning:** `supabase.co` may itself be blocked by GFW. Use Japan VPS for production.

### What Works / What Doesn't

| Content Type | Works? | Notes |
|---|---|---|
| Own landing page (HTML) | ✅ | Primary use case |
| Own file downloads | ✅ | `proxy_buffering off` for large files |
| Own SPA (React/Vue) | ⚠️ Partial | Works if all assets served from same domain |
| Facebook / Instagram | ❌ | OAuth, CSP, JS-heavy — not feasible |
| Google / YouTube | ❌ | DRM, auth, reCAPTCHA — not feasible |

For blocked third-party sites: host a mirror page on your own server, proxy that instead.

---

## Proxy Gateway with Vendor Proxy (Recommended)

For QR links where the **destination website** is blocked by GFW, the recommended path is now:

```
CN user scans QR
  → Cloudflare Worker → Supabase redirect edge function
    → geo_route for CN → bypass_url = https://jp.company.com/page
      → proxy-gateway (always-on Node service)
        → outbound HTTP/SOCKS5 proxy vendor
          → actual origin server
```

This keeps `bypass_url` as a normal HTTPS URL for browsers while moving proxy credentials and egress handling to the server side.

### Setup (Recommended)

```bash
# 1. Configure proxy-gateway/.env
cd proxy-gateway
cp .env.example .env

# 2. Install dependencies and verify module loading
npm install
npm run check
npm run test

# 3. Run locally
npm run dev
```

Required env vars:

- `UPSTREAM_ORIGIN=https://www.company.com` — the origin to proxy to (required)
- `PORT=8080` — pre-set in `fly.toml` (do not change)
- `HEALTH_REVEAL_UPSTREAM=true` — optional; reveals upstream URL in `/health` response (for debug only — leave unset in production to avoid GFW fingerprinting)
- `OUTBOUND_PROXY_URL=socks5://...` — optional; only needed if routing via a SOCKS5/HTTP vendor proxy. Leave unset for direct mode (Fly.io Tokyo connects directly to origin).

### Deploy on Fly.io (primary approach)

`proxy-gateway/fly.toml` is pre-configured for `nrt` (Tokyo) with app name `qrlive-jp-proxy`.

```bash
# 1. Create Fly.io app (one-time)
flyctl auth login
flyctl apps create qrlive-jp-proxy --machines

# 2. Set required secret
flyctl secrets set UPSTREAM_ORIGIN=https://www.company.com --app qrlive-jp-proxy

# 3. Deploy from proxy-gateway/ directory
cd proxy-gateway
flyctl deploy --app qrlive-jp-proxy

# 4. Verify health
curl https://qrlive-jp-proxy.fly.dev/health
# Expected: {"status":"ok","proxyMode":"direct"}
```

`fly.toml` keeps `min_machines_running = 1` and `auto_stop_machines = "off"` so the gateway stays always-on for QR traffic.

**GFW block recovery** (switch to Singapore standby):
```bash
flyctl regions set sin --app qrlive-jp-proxy && flyctl deploy --app qrlive-jp-proxy
# Or flip DNS to pre-created qrlive-sg-proxy app + bulk SQL update bypass_url
```

### Configure bypass_url in QRLive

1. Dashboard → edit QR link → geo-routes section
2. Add CN (China) row:
   - **Target URL**: `https://www.company.com/page`
   - **Bypass URL**: `https://jp.company.com/page`
3. Save → test end-to-end using a real CN VPN or China-based device.
   > ⚠️ **Do NOT use `curl -H "cf-ipcountry: CN"`** — it bypasses the Cloudflare Worker and does not reflect real geo-routing behavior.

### Legacy alternative

The nginx-based `japan-proxy/` setup still works, but it is now a legacy alternative when you prefer your own reverse proxy over a vendor-backed HTTP/SOCKS5 egress path.

## Support & Resources

- **Supabase Docs**: https://supabase.com/docs
- **Vercel Docs**: https://vercel.com/docs
- **React Query Docs**: https://tanstack.com/query
- **Shadcn/ui**: https://ui.shadcn.com
- **Supabase Discord**: https://discord.gg/supabase
