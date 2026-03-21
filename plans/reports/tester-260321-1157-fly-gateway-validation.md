---
name: fly-gateway-validation
description: Validation report for Fly-only proxy-gateway cost optimization changes
type: project
---

# Fly gateway validation

## Scope
- proxy-gateway/fly.toml
- proxy-gateway/fly.toml.example
- proxy-gateway/README.md
- docs/deployment-guide.md
- docs/system-architecture.md

## Checks run
- `npm --prefix proxy-gateway run check`
- `npm --prefix proxy-gateway run test`

## Test Results Overview
- proxy-gateway module check: pass
- proxy-gateway smoke tests: 4/4 pass
- failed: 0
- skipped: 0

## Coverage Metrics
- Not run in this validation pass.

## Build Status
- Proxy-gateway validation status: pass
- No build or runtime regressions seen in the gateway smoke path.

## Behavior Review
- `fly.toml` keeps the gateway on `shared-cpu-1x`, `256mb`, `auto_stop_machines = "off"`, and `min_machines_running = 1`.
- `fly.toml.example` matches the same low-cost always-on sizing.
- README + docs align on the always-on Fly.io Tokyo gateway and the cost-down sizing guidance.
- No behavior change detected in the gateway smoke tests: direct mode, upstream reveal toggle, redirect rewrite, and proxy-agent selection still pass.

## Critical Issues
- None found in the gateway-specific validation.

## Recommendations
- Keep the existing gateway smoke tests as the regression gate for future Fly config edits.
- If cost tuning changes again, rerun the same two checks before merging.

## Unresolved Questions
- Should a separate deploy smoke against a real Fly app be added, or is the current module + test coverage sufficient for this repo?
