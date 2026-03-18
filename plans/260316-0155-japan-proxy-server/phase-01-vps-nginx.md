---
phase: 1
title: "Deploy proxy-gateway to Fly.io Tokyo"
status: done
priority: P1
effort: 1h
---

# Phase 1: Deploy proxy-gateway to Fly.io Tokyo

## Context Links

- [proxy-gateway/src/server.mjs](../../proxy-gateway/src/server.mjs)
- [proxy-gateway/fly.toml](../../proxy-gateway/fly.toml)
- [proxy-gateway/.env.example](../../proxy-gateway/.env.example)
- [plan.md](./plan.md)

## Overview

Deploy the existing `proxy-gateway/` service to Fly.io Tokyo and use it as the production `bypass_url` target for QRLive CN geo-routes.

## Production Endpoint

- Public host: `https://qrlive-jp-proxy.fly.dev`
- Region: `nrt` (Tokyo)
- Model: one Fly app per upstream origin

## Architecture

```
CN user browser
  -> QRLive redirect edge function
    -> CN geo_route bypass_url = https://qrlive-jp-proxy.fly.dev/path
      -> Fly.io Tokyo proxy-gateway
        -> UPSTREAM_ORIGIN
```

## Implementation Steps

1. Create or confirm the Fly app:
   - `flyctl apps create qrlive-jp-proxy --machines`
2. Configure the upstream:
   - `flyctl secrets set UPSTREAM_ORIGIN=https://www.company.com --app qrlive-jp-proxy`
3. Deploy:
   - `flyctl deploy --app qrlive-jp-proxy`
4. Verify:
   - `curl https://qrlive-jp-proxy.fly.dev/health`
   - `curl -I https://qrlive-jp-proxy.fly.dev/`
5. Use the Fly hostname in QRLive `bypass_url` for CN routes

## Live Verification

- `https://qrlive-jp-proxy.fly.dev/health` returned `{"status":"ok","proxyMode":"direct"}`
- `https://qrlive-jp-proxy.fly.dev/` returned `200`
- Root response included `Content-Type: text/html; charset=utf-8`

## Recovery Runbook

If Tokyo is degraded or blocked, move the same app to Singapore and keep the hostname unchanged:

```bash
flyctl regions set sin --app qrlive-jp-proxy
flyctl deploy --app qrlive-jp-proxy
```

Create a separate standby hostname only if later operations need lower-RTO failover.

## Success Criteria

- [x] Fly app exists for `qrlive-jp-proxy`
- [x] `UPSTREAM_ORIGIN` is configured
- [x] Fly deployment succeeded
- [x] `/health` returns `{"status":"ok","proxyMode":"direct"}`
- [x] Public Fly hostname returns proxied HTML
- [x] Endpoint is suitable for QRLive `bypass_url`

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Tokyo region degraded or blocked | High | Move same app to `sin` and redeploy |
| Origin blocks Fly egress IPs | Medium | Allowlist Fly egress on origin |
| Third-party JS-heavy sites | High | Use mirrored content instead |

## Security Notes

- `UPSTREAM_ORIGIN` is fixed per app, so this is not an open proxy
- TLS terminates at Fly.io; upstream TLS verification remains enabled in the gateway
- Health output is minimal by default to reduce fingerprinting
