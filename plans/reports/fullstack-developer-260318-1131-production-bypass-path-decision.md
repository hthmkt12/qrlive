# Production bypass path decision

## Decision

- Use Fly.io Phase 1 as the production bypass path.
- Keep Supabase Phase 2 as fallback/testing only.

## Why

- `qrlive-jp-proxy.fly.dev` is live.
- `/health` returned `{"status":"ok","proxyMode":"direct"}`.
- Root request returned `200` with `Content-Type: text/html; charset=utf-8`.
- The managed Supabase proxy still rewrote live HTML GET responses to `text/plain` on shared `supabase.co`, so it is not the right production path for browser-facing bypass traffic.
- `qrlive-sg-proxy.fly.dev` did not resolve, so I removed the assumption that a second Singapore hostname is already live.

## Actions taken

- Rewrote the plan overview at `plans/260316-0155-japan-proxy-server/plan.md` to mark the plan complete and record the production decision.
- Rewrote `plans/260316-0155-japan-proxy-server/phase-01-vps-nginx.md` to reflect the live Fly gateway and the same-app region-switch recovery path.
- Updated `docs/deployment-guide.md` to use same-app failover to `sin` instead of assuming a pre-created Singapore hostname.
- Tightened `BYPASS_URL_ALLOWLIST` to the production Fly hostname only.
- Redeployed the `redirect` edge function after the allowlist secret update.

## Validation

- `npx -y supabase secrets set BYPASS_URL_ALLOWLIST=qrlive-jp-proxy.fly.dev` ✅
- `npx -y supabase functions deploy redirect --no-verify-jwt` ✅
- `npx -y supabase secrets list` shows `BYPASS_URL_ALLOWLIST` present ✅

## Operational note

- If Tokyo is degraded or blocked, move the same app to Singapore:
  - `flyctl regions set sin --app qrlive-jp-proxy`
  - `flyctl deploy --app qrlive-jp-proxy`
- This keeps the same public hostname, so QRLive `bypass_url` values do not need to change.

Unresolved questions:
- A real China-side or CN-VPN end-to-end test for the specific customer destination is still worth running before calling the rollout complete.
