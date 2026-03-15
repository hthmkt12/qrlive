---
phase: 1
title: "Deploy proxy-gateway to Fly.io Tokyo"
status: done
priority: P1
effort: 1h
---
<!-- Updated: Validation Session 1 - Replace nginx VPS with proxy-gateway Fly.io Tokyo (nrt), 1 upstream per app, direct connection -->

# Phase 1: Deploy proxy-gateway to Fly.io Tokyo

## Context Links

- [proxy-gateway/src/server.mjs](../../proxy-gateway/src/server.mjs) — HTTP proxy server
- [proxy-gateway/fly.toml.example](../../proxy-gateway/fly.toml.example) — already configured for nrt
- [proxy-gateway/.env.example](../../proxy-gateway/.env.example) — env var reference
- [plan.md](./plan.md) — overview

## Overview

Deploy the existing `proxy-gateway/` Node.js server to Fly.io Tokyo region. The server already:
- Reverse-proxies all requests to a single `UPSTREAM_ORIGIN`
- Strips hop-by-hop headers, rewrites `location` headers
- Has `/health` endpoint
- `fly.toml.example` pre-configured with `primary_region = "nrt"`, health check, auto-restart

**Total new code needed: zero.** Only config + deployment.

## Architecture

```
CN user browser
  -> QRLive bypass_url (https://qrlive-jp-proxy.fly.dev/path)
    -> Fly.io Tokyo (nrt) — proxy-gateway Node.js
      -> UPSTREAM_ORIGIN (https://www.company.com/path)
        -> Response streamed back to user
```

## Implementation Steps

### Step 1: Create fly.toml

```bash
cd proxy-gateway
cp fly.toml.example fly.toml
```

Edit `fly.toml` — set a unique app name:
```toml
app = "qrlive-jp-proxy"   # change to preferred name
primary_region = "nrt"    # Tokyo — already set
```

### Step 2: Create Fly.io app

```bash
# Install flyctl if needed: https://fly.io/docs/hands-on/install-flyctl/
cd proxy-gateway
flyctl auth login
flyctl apps create qrlive-jp-proxy --machines
```

### Step 3: Set secrets

```bash
# Required — the upstream origin to proxy to
flyctl secrets set UPSTREAM_ORIGIN=https://www.company.com --app qrlive-jp-proxy

# Optional tuning (defaults are fine for most cases)
# flyctl secrets set REQUEST_TIMEOUT_MS=30000
# flyctl secrets set MAX_REDIRECTS=0
```

### Step 4: Deploy

```bash
cd proxy-gateway
flyctl deploy --app qrlive-jp-proxy
```

### Step 5: Verify

```bash
# Health check
curl https://qrlive-jp-proxy.fly.dev/health
# Expected: {"status":"ok","proxyMode":"direct","upstreamOrigin":"https://www.company.com"}

# Test proxy response
curl -I https://qrlive-jp-proxy.fly.dev/
# Expected: proxied headers from www.company.com
```

### Step 6: Set bypass_url in QRLive

1. QRLive UI → edit link → CN geo-route
2. Set `bypass_url` to `https://qrlive-jp-proxy.fly.dev/path`
3. Test end-to-end via actual CN VPN (do NOT rely solely on `cf-ipcountry: CN` header test — it bypasses Cloudflare Worker)

## Multiple Upstream Domains

One upstream per Fly.io app (KISS):

```bash
flyctl apps create qrlive-jp-proxy-site2 --machines
flyctl secrets set UPSTREAM_ORIGIN=https://site2.company.com --app qrlive-jp-proxy-site2
flyctl deploy --app qrlive-jp-proxy-site2 --config fly.toml
```

Set `bypass_url` to `https://qrlive-jp-proxy-site2.fly.dev/path` for the second link.

## Success Criteria

- [ ] `fly.toml` created from example with unique app name
- [ ] Fly.io app created in Tokyo (`nrt`)
- [ ] `UPSTREAM_ORIGIN` secret set
- [ ] `flyctl deploy` succeeds
- [ ] `/health` returns `{"status":"ok","proxyMode":"direct",...}`
- [ ] Proxied response matches origin response
- [ ] QRLive bypass_url redirect works end-to-end

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Fly.io app name taken | Low | Choose unique name |
| Fly.io Tokyo IP blocked by GFW | High | Switch to `hkg` region; update bypass_url |
| Origin server blocks Fly.io egress IPs | Medium | Allowlist Fly.io IPs on origin firewall |
| Free tier limits exceeded | Low | Fly.io Hobby $5/mo handles low traffic |

## GFW Block Recovery Runbook

If Fly.io Tokyo IPs get blocked, switch region to Hong Kong:

```bash
# Option A: Redeploy to hkg region
flyctl regions set hkg --app qrlive-jp-proxy
flyctl deploy --app qrlive-jp-proxy
```

SQL bulk bypass_url update (< 15 min RTO):
```sql
UPDATE geo_routes
SET bypass_url = replace(bypass_url, 'qrlive-jp-proxy.fly.dev', 'qrlive-hk-proxy.fly.dev')
WHERE bypass_url LIKE '%qrlive-jp-proxy.fly.dev%';
```

## Security Notes

- `UPSTREAM_ORIGIN` is hardcoded per app — not user-supplied (no SSRF risk)
- `OUTBOUND_PROXY_URL` not used — direct connection from Fly.io Tokyo
- SSL handled by Fly.io (auto TLS, no certbot management needed)
- Health endpoint returns `proxyMode` and `upstreamOrigin` — consider hiding in prod if GFW fingerprinting is a concern
