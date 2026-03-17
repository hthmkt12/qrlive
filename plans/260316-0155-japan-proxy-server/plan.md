---
title: "Japan Reverse Proxy Server for GFW Bypass"
description: "Deploy existing proxy-gateway/ Node.js server to Fly.io Tokyo (nrt) to enable Chinese users to access geo-blocked content via QRLive bypass_url"
status: in-progress
priority: P1
effort: 4h
branch: "n/a (infrastructure-only)"
tags: [infrastructure, fly.io, proxy-gateway, nodejs, china, gfw]
created: 2026-03-16
---

<!-- plan-status-sync:start -->
## Plan Status Sync

- Last synced: 2026-03-17 20:15
- Progress: 40%
- Derived status: in-progress

| Phase | Status | Progress | File |
| --- | --- | --- | --- |
| Deploy proxy-gateway to Fly.io Tokyo | in-progress | 33% | `phase-01-vps-nginx.md` |
| Supabase Edge Function Proxy (Optional) | pending | 0% | `phase-02-supabase-proxy-edge.md` |
| Integration Guide & Documentation | completed | 100% | `phase-03-integration-guide.md` |

Malformed active plan dirs:
- `260317-prod-readiness` - missing plan.md
<!-- plan-status-sync:end -->

# Japan Reverse Proxy Server

## Problem

Chinese customers scan QR codes but destination websites are blocked by GFW. QRLive already supports `bypass_url` in geo-routes — need a Japan-hosted reverse proxy as the bypass target.

## Flow

```
CN user scans QR
  -> Cloudflare Worker -> Supabase redirect edge function
    -> geo_route for CN -> bypass_url (https://qrlive-proxy-gateway.fly.dev/path)
      -> proxy-gateway (Fly.io Tokyo) -> actual content server
```

## Existing Infrastructure (NO changes needed to QRLive)

- `bypass_url` column in `geo_routes` table — functional
- Redirect edge function uses bypass_url at line 94
- UI dialogs support bypass_url input
- `proxy-gateway/` Node.js server already exists with `fly.toml.example` configured for `nrt` (Tokyo)

## Honest Limitations

- **Works for**: user-controlled content (own websites, landing pages, static files)
- **Does NOT work for**: Facebook, Google, YouTube (auth cookies, JS SPAs, CORS)
- **Third-party blocked sites**: mirror domain is the only viable approach

## Phases

| # | Phase | File | Status | Effort |
|---|-------|------|--------|--------|
| 1 | Deploy proxy-gateway to Fly.io Tokyo | [phase-01-vps-nginx.md](./phase-01-vps-nginx.md) | In Progress (code ready, awaiting flyctl deploy) | 1h |
| 2 | Supabase Edge Function proxy (optional) | [phase-02-supabase-proxy-edge.md](./phase-02-supabase-proxy-edge.md) | Pending | 2h |
| 3 | Integration guide & docs | [phase-03-integration-guide.md](./phase-03-integration-guide.md) | Complete | 1h |

## Recommendation

**Phase 1 is the primary approach** — deploy existing `proxy-gateway/` to Fly.io Tokyo. `fly.toml.example` already correct. 1 Fly.io app = 1 upstream domain (KISS). Phase 2 optional/fallback.

## Dependencies

- Fly.io account + `flyctl` CLI installed
- Domain or custom hostname for proxy (optional — Fly.io provides `appname.fly.dev`)
- Target origin server accessible from Japan

## Security Principles

- Single hardcoded `UPSTREAM_ORIGIN` per app (not open proxy)
- No `OUTBOUND_PROXY_URL` — direct connection from Fly.io Tokyo
- SSL handled by Fly.io (auto-cert)
- No caching of authenticated content (`proxy_no_cache` in axios config)

## Risk: GFW IP Block Recovery [F5]

> **[F5-FIXED — Fly.io]** Fly.io simplifies recovery — no VPS provisioning:
> 1. **Primary:** `nrt` (Tokyo). **Standby:** pre-created `qrlive-sg-proxy` app in `sin` (Singapore — accessible from CN)
> 2. Switch: `flyctl regions set sin --app qrlive-jp-proxy && flyctl deploy --app qrlive-jp-proxy` OR flip to standby app
> 3. SQL bulk update (< 15 min RTO):
>    ```sql
>    UPDATE geo_routes SET bypass_url = replace(bypass_url, 'qrlive-jp-proxy.fly.dev', 'qrlive-sg-proxy.fly.dev')
>    WHERE bypass_url LIKE '%qrlive-jp-proxy.fly.dev%';
>    ```

## Red Team Review

### Session — 2026-03-16
**Findings:** 15 (15 accepted, 0 rejected)
**Severity breakdown:** 4 Critical, 7 High, 4 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | SSRF via `redirect:follow` bypasses allowlist | Critical | Accept | Phase 2 |
| 2 | Proxy secret exposed in URL/QR code/DB/logs | Critical | Accept | Phase 2 |
| 3 | SSL bootstrap chicken-and-egg | Critical | ~~Accept~~ **N/A** | Phase 1 — superseded by Fly.io (auto TLS) |
| 4 | Silent certbot renewal failure + no reload hook | Critical | ~~Accept~~ **N/A** | Phase 1 — superseded by Fly.io |
| 5 | GFW IP block has no recovery runbook | High | Accept | plan.md — updated to Fly.io Singapore runbook |
| 6 | X-Forwarded-For spoofing / IP reputation laundering | High | ~~Accept~~ **N/A** | Phase 1 — proxy-gateway handles XFF internally |
| 7 | `--no-verify-jwt` with leaked secret = zero-factor auth | High | Accept | Phase 2 |
| 8 | nginx upstream DNS once at startup | High | ~~Accept~~ **N/A** | Phase 1 — superseded by Fly.io |
| 9 | `certbot:latest` unpinned — exposes TLS private key | High | ~~Accept~~ **N/A** | Phase 1 — superseded by Fly.io |
| 10 | No upstream TLS certificate verification — DNS hijack | High | Accept | Phase 1 — proxy-gateway should verify upstream TLS |
| 11 | `bypass_url` accepts any HTTPS URL, no domain restriction | High | Accept | Phase 3 — separate plan required |
| 12 | CORS `ACAO: *` on proxied responses | Medium | Accept | Phase 2 |
| 13 | Health endpoint fingerprints proxy for GFW scanners | Medium | Accept | Phase 1 — review proxy-gateway /health response |
| 14 | `cf-ipcountry: CN` test bypasses Cloudflare Worker | Medium | Accept | Phase 3 |
| 15 | No log rotation — disk exhaustion on small VPS | Medium | ~~Accept~~ **N/A** | Phase 1 — superseded by Fly.io (managed logs) |

---

## Validation Log

### Session 1 — 2026-03-16
**Trigger:** Pre-implementation validation interview
**Questions asked:** 5

#### Questions & Answers

1. **[Architecture]** Gateway + HTTP proxy — which approach?
   - Options: API Gateway + nginx | HTTP CONNECT proxy (Squid) | Traefik gateway | proxy-gateway/ folder in repo
   - **Answer:** proxy-gateway/ folder có sẵn trong repo
   - **Rationale:** Existing Node.js proxy server with fly.toml.example — no new code needed

2. **[Scope]** What to do with proxy-gateway/?
   - Options: Extend current | Rewrite from scratch | Show me what's in it
   - **Answer:** Mở rộng proxy-gateway/ hiện tại (extend existing)
   - **Rationale:** Code is solid — HTTP proxy with header handling, health check, SOCKS5 support. Just deploy.

3. **[Architecture]** Deploy proxy-gateway to where for Japan?
   - Options: Fly.io Tokyo | VPS Tokyo (Docker) | Cloudflare Workers
   - **Answer:** Fly.io Tokyo region
   - **Rationale:** fly.toml.example already set to `nrt`, health check configured, no VPS management needed

4. **[Scope]** Multi-upstream support needed?
   - Options: 1 domain per app (KISS) | Multi-domain routing via Host header
   - **Answer:** 1 domain — giữ nguyên KISS
   - **Rationale:** One Fly.io app per upstream — simpler, more isolated, easier to debug

5. **[Architecture]** Use OUTBOUND_PROXY_URL (SOCKS5)?
   - Options: No — direct from Japan | Yes — via outbound proxy
   - **Answer:** Không — kết nối trực tiếp từ Japan server
   - **Rationale:** Fly.io Tokyo is already in Japan, direct connection to origin is sufficient

#### Confirmed Decisions

- **Implementation**: Use existing `proxy-gateway/` Node.js — zero new code
- **Deploy target**: Fly.io Tokyo (`nrt`) via `fly.toml.example`
- **Upstreams**: 1 `UPSTREAM_ORIGIN` per Fly.io app (KISS)
- **Outbound**: Direct connection, no SOCKS5

#### Action Items

- [x] Phase 1 rewritten: nginx VPS → Fly.io proxy-gateway deploy (~1h)
- [x] Plan frontmatter updated: tags, effort (6h→4h), description
- [x] Phase 3 comparison table updated: nginx → proxy-gateway Fly.io
- [x] Red team findings 3,4,6,8,9,15 (nginx-specific) marked N/A — superseded by Fly.io
- [x] F5 GFW recovery runbook updated: Linode/Vultr backup → Fly.io Singapore standby app
- [x] Phase 3 nginx config templates removed (stale); replaced with Fly.io deployment patterns

#### Impact on Phases

- Phase 1: **Major rewrite** — nginx VPS setup replaced with `flyctl deploy` steps (~1h vs 3h)
- Phase 2: No change — Supabase edge function remains optional fallback
- Phase 3: Minor — comparison table updated; nginx config templates removed; Fly.io deployment patterns added

### Session 2 — 2026-03-16
**Trigger:** Post-red-team validation (plan architecture shifted to Fly.io after Session 1)
**Questions asked:** 6

#### Questions & Answers

1. **[Scope]** Keep Phase 2 (Supabase edge proxy) given auth header coupling requirement?
   - Options: Keep as optional | Drop Phase 2 | Keep, defer auth fix
   - **Answer:** Keep Phase 2 as optional
   - **Rationale:** Useful for quick testing before committing to Fly.io; auth coupling documented

2. **[Architecture]** Expected number of target domains at launch?
   - Options: 1 domain | 2-5 domains | 10+ domains
   - **Answer:** 1 domain (single customer)
   - **Rationale:** KISS — one Fly.io app, one `UPSTREAM_ORIGIN`; scale by duplicating app

3. **[Scope]** bypass_url domain restriction (F11) — handle how?
   - Options: Create separate plan | Add to Phase 3 | Accept risk
   - **Answer:** Create a separate plan
   - **Rationale:** QRLive redirect edge function change is out of scope for infra-only plan

4. **[Architecture]** Monitoring approach?
   - Options: Simple cron + email | UptimeRobot | None
   - **Answer:** Simple cron + email (as planned)
   - **Rationale:** Sufficient for MVP; UptimeRobot is a free upgrade path

5. **[Architecture]** Phase 1 rewrite for Fly.io?
   - Options: Rewrite Phase 1 for Fly.io + proxy-gateway | Keep nginx as fallback
   - **Answer:** Rewrite Phase 1 for Fly.io (already done)
   - **Rationale:** Existing proxy-gateway + fly.toml.example = zero new code

6. **[Risk]** GFW IP block recovery with Fly.io?
   - Options: Second Fly.io app in Singapore | nginx VPS cold standby | Accept single deployment
   - **Answer:** Second Fly.io app in Singapore
   - **Rationale:** Fastest RTO — pre-created app, `flyctl deploy`, SQL bulk update in < 15 min

#### Confirmed Decisions

- **Phase 2**: Keep as optional fallback with auth header fix required
- **Scale**: Launch with 1 domain; add apps per domain as needed
- **F11 fix**: Separate plan for bypass_url domain restriction in redirect edge function
- **Monitoring**: Cron + email; UptimeRobot as upgrade path
- **GFW recovery**: Pre-created `sin` (Singapore) Fly.io app as standby

#### Action Items

- [x] F5 runbook updated: Linode/Vultr → Singapore Fly.io standby
- [x] Red team nginx findings marked N/A
- [x] Phase 3 nginx templates replaced with Fly.io deployment patterns
- [ ] Create separate plan: bypass_url domain restriction in redirect edge function
