# Proxy runtime limitation doc sync

## Scope

- Sync docs after live smoke testing the fallback Supabase proxy.
- Keep implementation honest about what is app behavior vs managed Supabase behavior.

## What changed

- Clarified runtime env usage in `supabase/functions/proxy/index.ts`:
  - `PROXY_ANON_KEY` is the recommended runtime secret.
  - `SUPABASE_ANON_KEY` is only a fallback if the runtime exposes it.
- Updated `phase-02-supabase-proxy-edge.md`:
  - auth wording now distinguishes caller contract vs runtime env lookup
  - response passthrough is documented as best-effort
  - success criteria now note that header preservation is validated in tests, while live HTML behavior on shared Supabase domains is a platform limitation
- Updated `docs/openapi.yaml`:
  - fallback proxy description now warns about managed Supabase rewriting HTML GET responses to `text/plain`
  - 200 response description reflects the live limitation
  - 401 response wording now covers both auth mechanisms
- Updated `docs/deployment-guide.md`:
  - added warning that the shared `supabase.co` domain is not a clean replacement for Fly.io when exact HTML headers matter

## Validation

- `npm run typecheck` ✅
- `npm run test` ✅ (`366/366`)
- Live smoke test status remained `200 OK` for allowlisted `qrlive.vercel.app`
- Live runtime still returned `Content-Type: text/plain` for proxied HTML on shared `supabase.co`

## Conclusion

- Auth, allowlist, deploy, and live fallback proxy access are working.
- Exact HTML `Content-Type` / `Content-Length` passthrough is not reliable on the managed shared Supabase domain.
- Fly.io Phase 1 remains the production path.

Unresolved questions:
- Whether the team wants to keep the current Supabase proxy only as testing/emergency fallback, or pursue a custom domain if exact browser-facing HTML passthrough becomes required.
