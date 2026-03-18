# Live bypass smoke and worker findings

## Scope

- Test the production bypass path end-to-end.
- Use the same redirect URL shape the live frontend currently shows.

## What I verified

- Live frontend currently renders wrapper URLs on:
  - `https://qrlive-redirect.hthmkt1.workers.dev/{shortCode}`
- Fly bypass gateway is healthy:
  - `https://qrlive-jp-proxy.fly.dev/health` returned `{"status":"ok","proxyMode":"direct"}`
  - root request returned `200` with `Content-Type: text/html; charset=utf-8`
- Cloudflare worker secrets were missing after redeploy:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
- I restored both secrets and redeployed.

## Code changes made during testing

- Worker now derives geo country from Cloudflare runtime metadata via `request.cf.country`
- Worker forwards that value as `x-geo-country`
- Redirect handler now accepts `x-geo-country` when `cf-ipcountry` is absent
- Added regression tests for both sides
- Updated worker README with a warning not to rely on shared `workers.dev` for final production geo-routing

## Validation

- `npx vitest run cloudflare-worker/redirect-proxy.test.js` ✅
- `npx vitest run cloudflare-worker/redirect-proxy.test.js src/test/redirect-handler.test.ts` ✅
- `npx wrangler deploy --config cloudflare-worker/wrangler.toml` ✅
- `npx -y supabase functions deploy redirect --no-verify-jwt` ✅
- `curl https://qrlive-redirect.hthmkt1.workers.dev/NOPE` now returns `404 {"error":"Link not found or inactive"}` ✅

## Live smoke result

- I created temporary authenticated links with geo-routes covering all 15 supported country codes.
- I requested the live worker URL exactly as production QR wrappers do.
- Result: redirect still fell back to `default_url`, not `bypass_url`.
- I queried the recorded click row for the same request.
- Recorded `country_code` was an empty string.

## Conclusion

- App-side bypass logic is implemented and deployed.
- Worker-side forwarding code is implemented and deployed.
- But the current production redirect base (`*.workers.dev`) is still not producing usable country data for live geo-routing in this setup.
- Because country arrives empty, `geo_routes` never match and `bypass_url` is never selected.

## Most likely operational blocker

- Production is using `https://qrlive-redirect.hthmkt1.workers.dev` instead of a real Cloudflare route/custom domain.
- Docs already recommend `r.yourdomain.com`; the live smoke strongly suggests that should now be treated as required, not optional, if geo-routing must work reliably.

## Next action

- Bind the worker to a real Cloudflare route/custom domain.
- Update Vercel `VITE_REDIRECT_BASE_URL` from `*.workers.dev` to that domain.
- Rerun the same live smoke after the custom-domain cutover.

Unresolved questions:
- Whether Cloudflare omits geo country specifically on `workers.dev` in this deployment shape, or whether another upstream platform detail is stripping it before the Supabase edge function sees it.
