# Cloudflare Worker — QR Redirect Proxy

Proxies QR redirect requests through the production hostname `r.worldgate.space` to the Supabase Edge Function. Purpose: make QR links accessible from China and regions where `supabase.co` is blocked.

## How It Works

```
Client → r.worldgate.space/CODE → Cloudflare Worker → Supabase Edge Function → 302 redirect
                                      ↑
                              Injects auth headers
                              Forwards country from request.cf.country as x-geo-country
                              Forwards POST body (password links)
```

Supported paths: `/CODE` and `/r/CODE` (both resolve to the same short code).

## Secrets Setup

Set via Wrangler CLI — **never commit** secret values:

```bash
cd cloudflare-worker

# Set Supabase project URL
wrangler secret put SUPABASE_URL
# Enter: https://<project-id>.supabase.co

# Set Supabase anon/public key
wrangler secret put SUPABASE_ANON_KEY
# Enter: <your-anon-key>
```

## Deploy

```bash
# From repo root
wrangler deploy --config cloudflare-worker/wrangler.toml
```

### DNS

`cloudflare-worker/wrangler.toml` now binds the Worker as a Cloudflare custom domain on `r.worldgate.space`.
No extra domain purchase is needed when you already control an active Cloudflare zone; a subdomain under that zone is enough.

### Vercel

Set `VITE_REDIRECT_BASE_URL=https://r.worldgate.space` in Vercel project env vars, then trigger a new Vercel deploy.

Do not treat `*.workers.dev` as the final production redirect base for geo-routing. This repo's live smoke checks observed empty country detection on the shared `workers.dev` hostname, so bind a real Cloudflare route or custom domain before depending on country-based redirects.

## Run Tests

```bash
# From repo root
npx vitest run cloudflare-worker/redirect-proxy.test.js
```

## Error Handling

| Status | Meaning |
|--------|---------|
| 500 | Missing `SUPABASE_URL` or `SUPABASE_ANON_KEY` secrets |
| 404 | No short code in path |
| 405 | Unsupported HTTP method (only GET/POST/OPTIONS) |
