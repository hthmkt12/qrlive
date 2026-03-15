---
title: "Japan Reverse Proxy Server for GFW Bypass"
description: "Infrastructure plan for Japan VPS nginx proxy enabling Chinese users to access geo-blocked content via QRLive bypass_url"
status: pending
priority: P1
effort: 6h
branch: n/a (infrastructure-only)
tags: [infrastructure, nginx, proxy, china, gfw, docker]
created: 2026-03-16
---

# Japan Reverse Proxy Server

## Problem

Chinese customers scan QR codes but destination websites are blocked by GFW. QRLive already supports `bypass_url` in geo-routes — need a Japan-hosted reverse proxy as the bypass target.

## Flow

```
CN user scans QR
  -> Cloudflare Worker -> Supabase redirect edge function
    -> geo_route for CN -> bypass_url (https://jp.example.com/page)
      -> Japan nginx reverse proxy -> actual content server
```

## Existing Infrastructure (NO changes needed)

- `bypass_url` column in `geo_routes` table — functional
- Redirect edge function uses bypass_url at line 94
- UI dialogs support bypass_url input

## Honest Limitations

- **Works for**: user-controlled content (own websites, landing pages, static files)
- **Does NOT work for**: Facebook, Google, YouTube (auth cookies, JS SPAs, CORS)
- **Third-party blocked sites**: mirror domain is the only viable approach

## Phases

| # | Phase | File | Status | Effort |
|---|-------|------|--------|--------|
| 1 | VPS nginx reverse proxy | [phase-01-vps-nginx.md](./phase-01-vps-nginx.md) | Pending | 3h |
| 2 | Supabase Edge Function proxy (optional) | [phase-02-supabase-proxy-edge.md](./phase-02-supabase-proxy-edge.md) | Pending | 2h |
| 3 | Integration guide & docs | [phase-03-integration-guide.md](./phase-03-integration-guide.md) | Pending | 1h |

## Recommendation

**Phase 1 is the primary approach.** Phase 2 is an alternative for users who want zero-infra, but Supabase itself may be blocked in China, limiting usefulness.

## Dependencies

- Japan VPS provider account (recommended: Vultr Tokyo, Linode Tokyo, or AWS ap-northeast-1)
- Domain pointing to Japan VPS (e.g., `jp.company.com`)
- Target origin server accessible from Japan

## Security Principles

- Allowlist-only proxy (never open proxy)
- Rate limiting at nginx level
- SSL termination via Let's Encrypt
- No caching of authenticated content
