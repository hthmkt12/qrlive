---
title: "Japan Reverse Proxy Server for GFW Bypass"
description: "Use Fly.io proxy-gateway as the production bypass target for QRLive geo_routes, with Supabase proxy kept as fallback only."
status: completed
priority: P1
effort: 4h
branch: "n/a (infrastructure-only)"
tags: [infrastructure, fly.io, proxy-gateway, china, gfw]
created: 2026-03-16
---

<!-- plan-status-sync:start -->
## Plan Status Sync

- Last synced: 2026-03-18 11:29
- Progress: 100%
- Derived status: completed

| Phase | Status | Progress | File |
| --- | --- | --- | --- |
| Deploy proxy-gateway to Fly.io Tokyo | completed | 100% | `phase-01-vps-nginx.md` |
| Supabase Edge Function Proxy (Optional) | completed | 100% | `phase-02-supabase-proxy-edge.md` |
| Integration Guide & Documentation | completed | 100% | `phase-03-integration-guide.md` |
<!-- plan-status-sync:end -->

# Overview

Chinese users need a stable `bypass_url` target for geo-routed QR links when the origin site is blocked by GFW.

## Production Decision

- **Primary path:** Fly.io Phase 1 on `https://qrlive-jp-proxy.fly.dev`
- **Fallback only:** Supabase Phase 2 proxy
- **Reason:** the Fly gateway is live and returns proxied HTML correctly; the managed Supabase proxy worked for auth and routing but live HTML responses on shared `supabase.co` were rewritten to `text/plain`

## Validation Snapshot

- `https://qrlive-jp-proxy.fly.dev/health` returned `{"status":"ok","proxyMode":"direct"}`
- `https://qrlive-jp-proxy.fly.dev/` returned `200` with `Content-Type: text/html; charset=utf-8`
- `https://qrlive-sg-proxy.fly.dev/health` did not resolve, so no second standby hostname is assumed live
- `bypass_url` restriction in the redirect function was implemented separately and already allows the Fly hostname path

## Recovery Path

- Keep the public hostname stable and move the same Fly app from `nrt` to `sin` if Tokyo is degraded or blocked:
  - `flyctl regions set sin --app qrlive-jp-proxy`
  - `flyctl deploy --app qrlive-jp-proxy`
- Only create a second Singapore app later if a lower-RTO standby is actually needed

## Phase Links

- [Phase 1: Deploy proxy-gateway to Fly.io Tokyo](./phase-01-vps-nginx.md)
- [Phase 2: Supabase Edge Function Proxy](./phase-02-supabase-proxy-edge.md)
- [Phase 3: Integration Guide & Documentation](./phase-03-integration-guide.md)

## Key Dependencies

- Fly.io app with `UPSTREAM_ORIGIN` configured
- QRLive geo-route `bypass_url` pointed at the Fly hostname for CN traffic
- Separate redirect-function allowlist secret permitting the Fly hostname

## Reports

- Latest runtime decision sync: `plans/reports/fullstack-developer-260318-1125-proxy-runtime-limitation-doc-sync.md`

## Next Steps

- Use the Fly hostname for real QRLive CN geo-routes
- Run a real China-side or CN-VPN end-to-end check for the specific customer destination
