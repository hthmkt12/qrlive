# Fly Cost Reduction Without Breaking Bypass Continuity

**Date**: 2026-03-21 12:02
**Severity**: Medium
**Component**: proxy-gateway / Fly.io deployment
**Status**: Resolved

## What Happened

Reduced Fly-only spend for the proxy-gateway, but kept the service always-on. We explicitly did not scale to zero because that would have risked cold-start gaps and broken continuity for existing `bypass_url` links.

Deployment config was tightened to `shared-cpu-1x` with `256mb` in both `proxy-gateway/fly.toml` and `fly.toml.example`. The app/hostname semantics stay on `qrlive-jp-proxy`, so existing bypass targets keep resolving the same way.

## The Brutal Truth

This was one of those changes where the wrong cost-saving move would have been cheaper on paper and worse in production. Scaling to zero would have felt clever and then immediately turned into a support problem when old bypass links started failing. We avoided that trap.

## Technical Details

- Fly VM pinned to `shared-cpu-1x` / `256mb`
- Gateway remains always-on, no scale-to-zero behavior
- Preserved `qrlive-jp-proxy` app/hostname contract for continuity
- Fixed `fly.toml.example` app-name mismatch to `qrlive-jp-proxy`
- Docs updated: `proxy-gateway/README.md`, `docs/deployment-guide.md`, `docs/system-architecture.md`, `docs/project-changelog.md`
- Validation: proxy-gateway module check passed; proxy-gateway tests passed 4/4

## What We Tried

- Considered scale-to-zero for lower Fly cost
- Rejected it after checking continuity requirements for existing bypass URLs
- Chose smaller always-on VM instead

## Root Cause Analysis

The core issue was cost pressure colliding with a live compatibility contract. The gateway is not just a convenience service; it is part of the resolution path for existing `bypass_url` links. Any change that alters availability semantics risks breaking old links, which is unacceptable.

## Lessons Learned

Cost optimization has to respect old links first. If a gateway is part of an established redirect path, always-on small footprint beats clever autoscaling. Also, example config drift is real; the `fly.toml.example` app-name mismatch was a small but nasty footgun.

## Next Steps

Monitor Fly spend after the VM resize. Keep `qrlive-jp-proxy` semantics stable for future deploys. If cost pressure returns, look for idle-request reduction before touching availability behavior.

## Unresolved Questions

None.
