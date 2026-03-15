# Plan Review: Japan Reverse Proxy — Assumption Destroyer

- **Plan:** `plans/260316-0155-japan-proxy-server/`
- **Reviewer perspective:** Assumption Destroyer (unstated dependencies, false "will work" claims, missing error paths, scale/integration assumptions)
- **Date:** 2026-03-16
- **Prior review on record:** `code-reviewer-260316-0359-japan-proxy-plan-review.md` (9 findings, overlapping on SSL bootstrap, certbot reload, PROXY_SECRET in URL, redirect:follow, CORS). This review does NOT duplicate those — it attacks different assumptions.

---

## Finding 1: The GFW IP Block Recovery Plan Is "Hope"

- **Severity:** Critical
- **Location:** Phase 1, "Risk Assessment" row "VPS IP blocked by GFW"
- **Flaw:** The mitigation reads "Use clean IP; switch provider if blocked." This presupposes that (a) the new provider's IP range is not also blocked, (b) DNS propagation completes in tolerable time, (c) someone is awake and monitoring when it happens, and (d) every `geo_routes.bypass_url` value in the database can be bulk-updated instantly. None of these are addressed. GFW has historically blocked entire ASNs (Vultr AS20473, Linode AS63949) in bulk sweeps. Switching to a different Tokyo VPS on the same ASN achieves nothing.
- **Failure scenario:** GFW blocks Vultr Tokyo's ASN at 2am on a Saturday. All CN users hitting QR codes get TCP timeouts. By the time the team notices (Monday morning via customer complaint), DNS TTL is 3600s and all `bypass_url` values in the database still point to the dead IP. Even after a new VPS is provisioned on a different provider, DNS takes up to an hour to propagate, nginx must be reconfigured with new certs, and a bulk SQL update is needed for every `geo_routes.bypass_url` row. No runbook, no SQL script, no estimated downtime. The plan's own Risk Assessment rates this "High impact" yet the mitigation is one sentence.
- **Evidence:** Phase 1 Risk Assessment: `VPS IP blocked by GFW | High | Use clean IP; switch provider if blocked`
- **Suggested fix:** Add: (1) pre-set DNS TTL to 60s before any change window; (2) a CNAME abstraction (`proxy.company.com CNAME jp-proxy.company.com`) so the A record swap is isolated; (3) a SQL snippet for bulk-updating `bypass_url` across `geo_routes`; (4) document that a second standby VPS on a different ASN should exist.

---

## Finding 2: `cf-ipcountry: CN` Test Does NOT Validate the Production Path

- **Severity:** Critical
- **Location:** Phase 1 Step 5; Phase 3 Step 7
- **Flaw:** The plan instructs testing by running `curl -H "cf-ipcountry: CN"` directly against the Supabase edge function URL. The redirect function reads `req.headers.get("cf-ipcountry")` — so this test passes. But in production, user traffic flows: `CN browser → QR code scan → Cloudflare Worker → Supabase edge function`. The `cf-ipcountry` header in production is injected by Cloudflare's network, not by the caller. When calling the Supabase function URL directly (bypassing Cloudflare), the header is caller-supplied and the test validates a shortcut, not the real path. If the Cloudflare Worker rewrites the URL, strips headers, or applies its own geo logic before calling Supabase, the test would pass while production silently fails.
- **Failure scenario:** Integration is declared "working" based on the curl simulation. A real CN user scans the QR code. The QR code resolves through the Cloudflare Worker, which has a routing bug or different geo logic. The Supabase function receives a different country code (or none). The user is sent to `target_url` (the blocked site) instead of `bypass_url`. No error — just a failed page load in China. The test never caught it because it bypassed the Cloudflare Worker entirely.
- **Evidence:** Phase 3, Step 7: `"Test by scanning QR code from China (or simulating with cf-ipcountry: CN header)"` — presented as equivalent options.
- **Suggested fix:** Require an end-to-end test via the actual QR code URL (which routes through Cloudflare) from a CN IP or a verified CN-exit VPN. The `curl` simulation is acceptable only for unit-testing the Supabase function in isolation — make this distinction explicit and gate "integration complete" on the real test.

---

## Finding 3: Multi-Domain Scaling Has No Lifecycle Management

- **Severity:** High
- **Location:** Phase 1, "Adding More Domains"
- **Flaw:** The plan describes adding a new customer domain as "add server blocks + re-run certbot + restart nginx." There is no process for: (a) removing domains when customers churn, (b) tracking which server block serves which customer, (c) per-domain health monitoring (only `/health` on the primary domain is monitored), (d) certbot rate limits when rapidly provisioning many domains (Let's Encrypt allows 50 certs/domain/week). If 10+ customers onboard simultaneously, certbot rate limits will be hit.
- **Failure scenario:** QRLive grows to 30 customer domains on the proxy. Each has its own server block. A batch of 8 customers onboards in the same week — certbot hits the Let's Encrypt rate limit on `jp.company.com` zone and starts failing new issuances silently (only `--quiet` errors in logs — see prior review). Churned customer domains from 6 months ago remain in nginx config, their origins now pointing to unrelated or malicious content, continuing to proxy for anyone who discovers the URL. The one monitored health endpoint at `/health` stays green throughout all of this.
- **Evidence:** Phase 1: "requires adding server blocks + re-running certbot per domain" — no mention of domain lifecycle, rate limits, or per-domain monitoring.
- **Suggested fix:** Document the domain ceiling (practical max without automation ~10–15), address domain removal procedure explicitly, and note Let's Encrypt rate limits. Beyond 15 domains, require a wildcard cert approach or automated config management (Ansible/Terraform).

---

## Finding 4: nginx `proxy_pass` to `upstream` Block Resolves DNS Once at Startup

- **Severity:** High
- **Location:** Phase 1, "nginx Configuration Template" — `upstream origin_company` block
- **Flaw:** The plan uses an `upstream` block pointing to `www.company.com:443`. nginx resolves the hostname in an `upstream` block at startup only — it is cached for the lifetime of the process. If the origin server's IP changes (DNS TTL expires, CDN migration, AWS EIP reassignment), nginx will continue connecting to the stale IP until restarted manually. This is a well-known nginx limitation with `upstream` blocks — `resolver` directive is required for dynamic re-resolution, and it is absent from the config.
- **Failure scenario:** Origin server migrates to a new host or CDN (e.g., Cloudflare changes its IP for `www.company.com`). nginx proxy starts receiving connection errors or connecting to the wrong host. Content served is stale or broken. The `/health` endpoint still returns 200 because it doesn't test proxy connectivity. The monitoring cron doesn't detect it. Debugging requires knowing this obscure nginx behavior — it's not in the plan.
- **Evidence:** Phase 1 nginx config: `upstream origin_company { server www.company.com:443; }` — no `resolver` directive, no `resolve` flag on the server line.
- **Suggested fix:** Use `resolver 8.8.8.8 valid=60s;` in the `http {}` block and add the `resolve` parameter to the upstream server line (`server www.company.com:443 resolve;`) — or use `proxy_pass https://www.company.com` directly with a resolver, which re-resolves per-request TTL.

---

## Finding 5: `bypass_url` Accepts Any HTTPS URL — No Domain Restriction in Redirect Function

- **Severity:** High
- **Location:** Phase 3, "How to Set bypass_url in QRLive UI"; `redirect/index.ts` line 95
- **Flaw:** The redirect edge function at line 95 does `targetUrl = geoRoute.bypass_url || geoRoute.target_url` with only a `^https?:\/\/` check (line 100). Any HTTPS URL stored in `bypass_url` will be issued as a 302 to users. There is no validation that the URL points to the intended Japan proxy domain. A compromised admin account, a typo, or a malicious insider can set `bypass_url` to any URL — phishing site, competitor domain, or data-harvesting page — and all CN users scanning the QR code are silently redirected there. The plan treats `bypass_url` as purely operational documentation with zero input validation discussion.
- **Failure scenario:** Admin pastes the wrong URL during setup (`https://jp.company.con/landing` — typo `.con`). Or a malicious actor with dashboard access changes it to `https://phishing.example.com`. CN users get 302'd to the wrong destination with no error, no alert, and no audit trail beyond the analytics (which records the bypassed country code, not a URL mismatch alarm). No success criteria checks `bypass_url` domain against an approved list.
- **Evidence:** `redirect/index.ts` line 95: `targetUrl = geoRoute.bypass_url || geoRoute.target_url` — no domain allowlist. Phase 3 success criteria does not include "bypass_url validated against registered proxy domains."
- **Suggested fix:** Add a domain allowlist to the redirect function for `bypass_url` values, or enforce it at the DB level with a check constraint. At minimum, add a UI confirmation step showing the full redirect chain before saving.

---

## Finding 6: Monitoring Depends on an Undefined "Another Server" with `mail` Configured

- **Severity:** Medium
- **Location:** Phase 1, "Step 6: Monitoring Setup"
- **Flaw:** The monitoring solution is `*/5 * * * * curl -sf https://jp.company.com/health || echo "JP proxy down" | mail -s "Alert" admin@company.com` — running on "another server." That server is never defined, `mail` is not installed by default on any modern Linux distro, and configuring an MTA is a multi-step process that could easily take longer than the "3h" effort estimate for the entire Phase 1. If the cron runs on the VPS being monitored, it is useless when the VPS goes down.
- **Failure scenario:** Engineer sets up monitoring cron on the Japan VPS itself (the obvious place). VPS goes down. Cron cannot fire. Alert is never sent. Team discovers the outage from customer complaints 8 hours later. If engineer correctly sets up cron on a separate server, `mail` binary is missing on fresh Ubuntu 22.04 (`sendmail` is not installed by default). Alert silently drops. Either way, monitoring is non-functional as documented.
- **Evidence:** Phase 1 Step 6: `"# Simple uptime check via cron on another server"` — "another server" undefined. `mail -s "Alert"` assumes functional MTA.
- **Suggested fix:** Replace with a webhook-based alert: `curl -sf https://jp.company.com/health || curl -s -X POST https://hooks.slack.com/services/WEBHOOK "..."` — zero MTA dependency. Explicitly name where this cron lives (e.g., "run this on your existing CI server or use a free uptime monitor like UptimeRobot").

---

## Finding 7: SPA Proxying "Partial" Rating Is Misleading — Breaks in Practice

- **Severity:** Medium
- **Location:** Phase 1, "What This CANNOT Do" table; Phase 3, "Complex SPAs" section
- **Flaw:** The plan rates "Proxy own SPA (React/Vue)" as "Partial — Works if API calls also go through proxy." This is technically accurate but operationally misleading. Most SPAs make API calls to the same origin (or a subdomain), load assets from a CDN, and use absolute URLs baked into the build. For a user in China accessing `jp.company.com`, the SPA HTML loads fine but then tries to call `https://api.company.com/data` directly (the original domain) — which is blocked by GFW. The plan does not document how to also proxy the API subdomain or reconfigure the SPA's environment variables to use proxy URLs.
- **Failure scenario:** Customer uses a React SPA at `www.company.com`. They set bypass_url to `https://jp.company.com`. The SPA loads. User clicks a button that calls `https://api.company.com/submit`. Request fails — `api.company.com` is blocked by GFW. The SPA appears broken. Customer blames QRLive. The plan's "Partial" rating gave no warning that this is the common case for SPAs, not the exception.
- **Evidence:** Phase 1 "What This CANNOT Do": `Proxy own SPA (React/Vue) | Partial | Works if API calls also go through proxy` — the caveat is buried and the failure mode not described.
- **Suggested fix:** Change the rating to "No (unless API is also proxied)" and add a concrete example of what "also proxied" requires (additional nginx server block for `jp-api.company.com → api.company.com`, plus SPA rebuild with updated API base URL). This is not a 30-minute task and the plan must not imply it is.

---

## Finding 8: Phase 2 `bypass_url` Contains Secret Key — Stored in Database Plaintext

- **Severity:** Medium
- **Location:** Phase 2, "Architecture"; Phase 3 "Integration Guide"
- **Flaw:** Phase 2's bypass_url is `https://PROJECT.supabase.co/functions/v1/proxy?url=https://www.company.com/page&key=SECRET`. This full URL is stored in the `geo_routes.bypass_url` column in Supabase's database. Any user with read access to the `geo_routes` table (including Supabase dashboard viewers, read-only DB users, and any Supabase support access) can extract the `PROXY_SECRET` directly from the stored URL. The plan documents secret rotation nowhere — if the secret is compromised, every `bypass_url` in the database must be updated.
- **Failurerage scenario:** Three months after deployment, a developer is debugging a geo-routing issue and runs `SELECT bypass_url FROM geo_routes WHERE country_code = 'CN'` in the Supabase SQL editor. The output is copy-pasted into a Slack message for debugging. `PROXY_SECRET=abc123xyz` is now in Slack logs forever. No rotation procedure exists. The proxy is now usable by anyone in that Slack workspace.
- **Evidence:** Phase 2 architecture: `?url=https://www.company.com/page&key=SECRET`. No secret rotation section in Phase 2.
- **Suggested fix:** Move the secret to a request header (as noted in prior review). Add a "Secret Rotation Procedure" section: how to generate a new secret, update the Supabase secret, and bulk-update all `bypass_url` values in `geo_routes` atomically to avoid a downtime window.

---

## Unresolved Questions

1. What is the actual target domain? Phase 3 explicitly admits it's unknown. Every nginx config, certbot command, and DNS instruction uses `company.com` as a placeholder — the plan cannot be executed verbatim.
2. Does the Cloudflare Worker (the entry point before Supabase) inject or validate `cf-ipcountry`, or does it pass the header through from the original request? This determines whether the Finding 2 test vulnerability is exploitable in production or already mitigated at the Cloudflare layer.
3. Is there a Supabase RLS policy on `geo_routes` that prevents non-owner users from reading `bypass_url`? If not, any authenticated QRLive user can read the Phase 2 secret from the DB.
4. What traffic volume from China is anticipated? The "1GB RAM / 1 vCPU" recommendation is asserted to handle "10K+ concurrent easily" but this claim is unvalidated for HTTPS proxy workloads with SSL termination overhead.
