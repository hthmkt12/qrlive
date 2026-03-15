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

## Risk: GFW IP Block Recovery [F5]

> **[F5-FIXED]** "Switch provider" is not a plan — it's hours of downtime. Maintain:
> 1. A standby VPS on a different ASN (Linode if primary is Vultr, etc.)
> 2. SQL script ready: `UPDATE geo_routes SET bypass_url = replace(bypass_url, 'old-jp.company.com', 'new-jp.company.com') WHERE bypass_url LIKE '%old-jp%';`
> 3. A pre-registered backup domain with DNS pre-configured (TTL=60)
> 4. Target RTO: <15 minutes with this runbook

## Red Team Review

### Session — 2026-03-16
**Findings:** 15 (15 accepted, 0 rejected)
**Severity breakdown:** 4 Critical, 7 High, 4 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | SSRF via `redirect:follow` bypasses allowlist | Critical | Accept | Phase 2 |
| 2 | Proxy secret exposed in URL/QR code/DB/logs | Critical | Accept | Phase 2 |
| 3 | SSL bootstrap chicken-and-egg | Critical | Accept | Phase 1 |
| 4 | Silent certbot renewal failure + no reload hook | Critical | Accept | Phase 1 |
| 5 | GFW IP block has no recovery runbook | High | Accept | plan.md |
| 6 | X-Forwarded-For spoofing / IP reputation laundering | High | Accept | Phase 1 |
| 7 | `--no-verify-jwt` with leaked secret = zero-factor auth | High | Accept | Phase 2 |
| 8 | nginx upstream block resolves DNS once at startup | High | Accept | Phase 1 |
| 9 | `certbot:latest` unpinned — exposes TLS private key | High | Accept | Phase 1 |
| 10 | No upstream TLS certificate verification — DNS hijack | High | Accept | Phase 1 |
| 11 | `bypass_url` accepts any HTTPS URL, no domain restriction | High | Accept | Phase 3 |
| 12 | CORS `ACAO: *` on proxied responses | Medium | Accept | Phase 2 |
| 13 | Health endpoint fingerprints proxy for GFW scanners | Medium | Accept | Phase 1 |
| 14 | `cf-ipcountry: CN` test bypasses Cloudflare Worker | Medium | Accept | Phase 3 |
| 15 | No log rotation — disk exhaustion on small VPS | Medium | Accept | Phase 1 |
