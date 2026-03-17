# Cloudflare Worker — QR Redirect Proxy

Proxies QR redirect requests through a custom domain (`r.yourdomain.com`) to the Supabase Edge Function. Purpose: make QR links accessible from China and regions where `supabase.co` is blocked.

## How It Works

```
Client → r.yourdomain.com/CODE → Cloudflare Worker → Supabase Edge Function → 302 redirect
                                      ↑
                              Injects auth headers
                              Preserves cf-ipcountry
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

# Or with a custom route
wrangler deploy --config cloudflare-worker/wrangler.toml --route "r.yourdomain.com/*"
```

### DNS

Add a CNAME record: `r.yourdomain.com → <worker-name>.workers.dev` (Cloudflare proxied).

### Vercel

Set `VITE_REDIRECT_BASE_URL=https://r.yourdomain.com` in Vercel project env vars.

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
