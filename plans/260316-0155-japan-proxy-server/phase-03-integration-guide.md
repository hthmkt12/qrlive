---
phase: 3
title: "Integration Guide & Documentation"
status: done
priority: P2
effort: 1h
---

# Phase 3: Integration Guide & Documentation

## Context Links

- [Deployment guide](../../docs/deployment-guide.md) — to be updated
- [plan.md](./plan.md)
- [Phase 1](./phase-01-vps-nginx.md) | [Phase 2](./phase-02-supabase-proxy-edge.md)

## Overview

Document how to connect the Japan proxy (Phase 1 or 2) with QRLive's existing bypass_url feature. No code changes in QRLive — purely operational documentation.

## How to Set bypass_url in QRLive UI

### Step-by-Step

1. Log in to QRLive at https://qrlive.vercel.app
2. Find the target QR link in your dashboard
3. Click edit (pencil icon) to open EditLinkDialog
4. Scroll to geo-routes section
5. For `CN` (China) row, fill in:
   - **Target URL**: the original destination (e.g., `https://www.company.com/landing`)
   - **Bypass URL**: the Japan proxy URL (e.g., `https://jp.company.com/landing`)
6. Save changes
7. Test by scanning QR code from China.
   > **[F14-FIXED] Do NOT use `curl -H "cf-ipcountry: CN"` as a production test** — it bypasses the Cloudflare Worker entirely and tests a shortcut. Use an actual CN VPN/proxy or a Cloudflare Worker test environment with real geo headers.

### How It Works

```
QRLive redirect edge function (line 86-96):
  1. Detects country from cf-ipcountry header
  2. Finds matching geo_route for CN
  3. Uses bypass_url if set, otherwise target_url
  4. 302 redirects user to bypass_url
  5. User's browser loads https://jp.company.com/landing
  6. Japan nginx proxies to https://www.company.com/landing
  7. Content served to user in China
```

## Approach Comparison

| Criteria | Phase 1: proxy-gateway on Fly.io | Phase 2: Supabase Edge Proxy |
|----------|----------------------------------|------------------------------|
| **Reliability from China** | High (Japan IP, not blocked) | Low (Supabase may be blocked) |
| **Setup complexity** | Low (flyctl deploy, ~1h) | Low (deploy edge function) |
| **Monthly cost** | Free tier / Hobby $5/mo | Free tier / usage-based |
| **Max content size** | Unlimited (stream) | 6MB |
| **SSL** | Fly.io auto TLS | Supabase handles |
| **Custom domain** | Yes (custom via Fly.io certs) | No (supabase.co domain) |
| **SPA support** | Partial (if API also proxied) | No |
| **File downloads** | Yes (streamed via pipeline) | Limited (6MB) |
| **Maintenance** | Minimal (Fly.io managed infra) | None |
| **Recommended for** | Production use | Quick testing only |

**Verdict:** Phase 1 (proxy-gateway on Fly.io) for production. Phase 2 only for proof-of-concept.

## Fly.io Deployment Patterns for Common Use Cases
<!-- Updated: Validation Session 2 - nginx templates removed; replaced with proxy-gateway Fly.io deployment commands -->

Each use case = one Fly.io app with `UPSTREAM_ORIGIN` set to the target server.

### 1. Simple Landing Page

```bash
flyctl apps create qrlive-jp-landing --machines
flyctl secrets set UPSTREAM_ORIGIN=https://www.company.com --app qrlive-jp-landing
flyctl deploy --app qrlive-jp-landing --config proxy-gateway/fly.toml
```

bypass_url: `https://qrlive-jp-landing.fly.dev/landing-page`

### 2. File Download Server

```bash
flyctl apps create qrlive-jp-files --machines
flyctl secrets set UPSTREAM_ORIGIN=https://files.company.com --app qrlive-jp-files
# For large files, set longer timeout:
flyctl secrets set REQUEST_TIMEOUT_MS=300000 --app qrlive-jp-files
flyctl deploy --app qrlive-jp-files --config proxy-gateway/fly.toml
```

bypass_url: `https://qrlive-jp-files.fly.dev/downloads/file.pdf`

### 3. Multi-Page Marketing Site

```bash
flyctl apps create qrlive-jp-marketing --machines
flyctl secrets set UPSTREAM_ORIGIN=https://marketing.company.com --app qrlive-jp-marketing
flyctl deploy --app qrlive-jp-marketing --config proxy-gateway/fly.toml
```

bypass_url: `https://qrlive-jp-marketing.fly.dev/campaign`

### 4. API Endpoint (JSON)

```bash
flyctl apps create qrlive-jp-api --machines
flyctl secrets set UPSTREAM_ORIGIN=https://api.company.com --app qrlive-jp-api
flyctl deploy --app qrlive-jp-api --config proxy-gateway/fly.toml
```

bypass_url: `https://qrlive-jp-api.fly.dev/api/endpoint`

## What Does NOT Work (Document Honestly)

### Third-Party Blocked Sites

| Site | Why It Fails | Alternative |
|------|-------------|-------------|
| Facebook | OAuth cookies, CSP headers, JS-heavy | Mirror landing page content only |
| Google | reCAPTCHA, auth, JS bundles | Not feasible |
| YouTube | DRM, adaptive streaming | Not feasible |
| Instagram | Auth required, API-driven SPA | Mirror static content only |
| Twitter/X | JS-heavy SPA, auth | Not feasible |

### Complex SPAs

If the origin is a complex React/Vue/Angular SPA:
- Relative asset URLs (`/static/js/main.js`) will load from proxy domain — OK if proxy handles all paths
- API calls to different domains will fail unless also proxied
- OAuth flows with redirect URIs will break (redirect URI mismatch)
- WebSocket connections need separate proxy config

### Recommendation for Blocked Third-Party Content

For content the user does NOT control:
1. **Mirror approach**: Copy the specific content to own server, proxy that
2. **Screenshot/PDF**: Generate static version of the page, host on own server
3. **Accept limitation**: Some content simply cannot be proxied

## Documentation Update: deployment-guide.md

Add the following section to `docs/deployment-guide.md`:

```markdown
## Japan Proxy Server (China GFW Bypass)

For QR links targeting Chinese users where the destination is blocked by GFW:

### Setup
1. Deploy nginx reverse proxy on Japan VPS (see `plans/260316-0155-japan-proxy-server/phase-01-vps-nginx.md`)
2. Point `jp.company.com` DNS to VPS
3. Configure nginx to proxy to target origin
4. In QRLive: edit link > CN geo-route > set bypass_url to `https://jp.company.com/path`

### How It Works
The redirect edge function prioritizes bypass_url over target_url for geo-routes.
Chinese users are redirected to the Japan proxy, which forwards to the actual content.

### Limitations
- Only works for content you control (own websites/servers)
- Does not work for Facebook, Google, YouTube, etc.
- Japan VPS IP could theoretically be blocked (unlikely but possible)
```

## Implementation Steps

1. Add Japan proxy section to `docs/deployment-guide.md`
2. Update references from nginx config to `proxy-gateway/` Fly.io approach
3. Verify all links in plan files are correct
4. Test documentation accuracy against actual deployment

## Success Criteria

- [ ] `docs/deployment-guide.md` updated with Japan proxy section
- [ ] Step-by-step guide covers full flow from VPS setup to QRLive config
- [ ] Limitations documented honestly
- [ ] Config templates provided for common use cases
- [ ] Comparison table helps user choose between Phase 1 and Phase 2

## Security Note: bypass_url Domain Restriction [F11]

> **The redirect edge function currently accepts any HTTPS URL as `bypass_url` with no domain restriction.**
> Any authenticated user with write access to `geo_routes` can redirect all CN users to an arbitrary HTTPS URL.
>
> **Required QRLive-level fix (separate issue):** Add a `BYPASS_URL_ALLOWED_DOMAINS` env var or per-link allowlist, validated in the redirect edge function before issuing the 302.

## Unresolved Questions

1. **Specific target domain?** Templates use `company.com` as placeholder — need actual domain
2. **Traffic volume from China?** Affects VPS sizing (1GB RAM handles ~1000 concurrent easily)
3. **Multiple target domains?** If yes, need multiple server blocks or wildcard cert
4. **Supabase accessibility from China?** Should test before investing in Phase 2
