# Plan Review: Japan Reverse Proxy Server for GFW Bypass
**Reviewer:** code-reviewer (Failure Mode Analyst)
**Date:** 2026-03-16
**Plan:** `plans/260316-0155-japan-proxy-server/`

---

## Finding 1: Chicken-and-Egg SSL Bootstrap — nginx Starts Blind
- **Severity:** Critical
- **Location:** Phase 1, "Step 3: Initial SSL Certificate" / Docker Compose
- **Flaw:** The nginx container mounts `certbot-certs:/etc/letsencrypt:ro` and immediately tries to load `ssl_certificate /etc/letsencrypt/live/jp.company.com/fullchain.pem`. On a fresh VPS that volume is empty. nginx will fail to start with a fatal config error before certbot can ever obtain a certificate. The bootstrap order is unsalvageable as documented.
- **Failure scenario:** Operator runs `docker compose up -d` first (natural default). nginx crashes on missing cert file. certbot container's webroot entrypoint starts but the ACME webroot path (`/.well-known/acme-challenge/`) is served by nginx — which is down. Certbot renewal loop also fails. System is stuck with no path to recovery without manual intervention not described anywhere in the plan.
- **Evidence:** Step 3 instructs `docker compose run --rm certbot certonly --webroot` as the very first cert command, but the HTTP-only server block for ACME depends on nginx being up to serve `/var/www/certbot`. If nginx is not up (because the SSL server block references a cert that does not yet exist), the ACME challenge fails. The plan says "get certificate before nginx starts with SSL" but nginx.conf has both HTTP and SSL server blocks in the same config file — a single failed `ssl_certificate` directive aborts the entire config load.
- **Suggested fix:** Split config into two files: `00-http-only.conf` (no SSL, just ACME + 301 redirect) deployed first, bring nginx up, run certbot, then add `01-ssl.conf`. Alternatively use `ssl_certificate_key` inside an `if` block or a dummy self-signed cert with a conditional include — but the two-file approach is the only clean solution.

---

## Finding 2: Silent Certbot Renewal Failures — Certs Expire Undetected
- **Severity:** Critical
- **Location:** Phase 1, Docker Compose `certbot` service / Risk Assessment
- **Flaw:** The certbot entrypoint loop runs `certbot renew --quiet` every 12 hours. `--quiet` suppresses all output including errors. The container has `restart: unless-stopped` but certbot renew exiting non-zero does NOT restart the container — the while loop continues to the next sleep. The monitoring cron (Step 6) only checks `/health` — an HTTP 200 — which nginx will return even while serving an expired certificate. The cron alert fires only after nginx is down, not when cert renewal fails.
- **Failure scenario:** Certbot renewal silently fails (e.g., Let's Encrypt rate limit hit, network blip, ACME challenge file not served due to nginx config change). The loop keeps running. Nobody notices for up to 90 days. The cert expires. nginx begins refusing SSL handshakes. CN users get certificate errors. The monitoring cron fires only after nginx crashes or is manually restarted. By then, QR codes for Chinese users have been silently broken for an unknown window of time.
- **Evidence:** `certbot renew --webroot -w /var/www/certbot --quiet` — `--quiet` flag. The risk table entry "SSL cert expiry: Medium — Certbot auto-renew + monitoring alert" implies monitoring detects renewal failure, but the monitoring cron only tests `http://localhost/health`, not cert expiry date.
- **Suggested fix:** Remove `--quiet`. Add a post-renew hook that signals nginx (`docker exec jp-proxy-nginx nginx -s reload`). Add a separate cron that checks cert expiry with `openssl s_client` and alerts if expiry < 14 days.

---

## Finding 3: Certbot Cannot Reload nginx — New Cert Never Activated
- **Severity:** High
- **Location:** Phase 1, Docker Compose `certbot` service entrypoint
- **Flaw:** Even when certbot renew succeeds and writes a new cert to the shared volume, nginx is never told to reload. nginx caches the cert file paths at startup and holds open file descriptors to the old cert. The new cert files are written but never read by the running nginx process until a manual restart.
- **Failure scenario:** Certbot successfully renews cert 30 days before expiry. New PEM files land in `certbot-certs` volume. nginx keeps serving the old cert (which expires in 30 days). On the expiry date, nginx begins rejecting SSL handshakes. The only fix is `docker compose restart nginx` — which the plan never schedules or documents.
- **Evidence:** No `nginx -s reload` or `docker exec jp-proxy-nginx nginx -s reload` command anywhere in the certbot entrypoint or a post-renew hook. The two containers share a volume but have no IPC mechanism.
- **Suggested fix:** Add a `--deploy-hook "docker exec jp-proxy-nginx nginx -s reload"` to the certbot renew command. This requires the certbot container to have access to the Docker socket (security consideration) or use a sidecar reload script triggered via the shared volume.

---

## Finding 4: PROXY_SECRET Exposed in URL Query String — Logged Everywhere
- **Severity:** High
- **Location:** Phase 2, "Architecture" and "Implementation Steps"
- **Flaw:** The secret key is passed as a URL query parameter (`?key=SECRET`). Query strings appear in: nginx access logs, Supabase function invocation logs, CDN/edge logs, browser history, HTTP referer headers on any resource load, and any monitoring tool that logs full URLs. The secret is effectively public.
- **Failure scenario:** A Supabase support ticket is opened, logs are reviewed by a Supabase engineer, or the Supabase dashboard is screen-shared during a demo. The `key=SECRET` value is visible in plain text in all function invocation logs. Anyone with the key can use the proxy function as a general-purpose HTTP fetcher for any host on the allowlist — including sending arbitrary requests to origin servers with a trusted User-Agent.
- **Evidence:** `curl "https://PROJECT.supabase.co/functions/v1/proxy?url=https://www.company.com&key=SECRET"` — key in URL. bypass_url stored in database also contains the key in plaintext in the `geo_routes` table.
- **Suggested fix:** Move the key to a request header (`Authorization: Bearer SECRET` or `X-Proxy-Key: SECRET`). bypass_url in the database then does not contain the credential. Supabase JWT auth (`--no-verify-jwt` removed) is an even better solution.

---

## Finding 5: redirect: "follow" in Edge Function Bypasses Allowlist
- **Severity:** High
- **Location:** Phase 2, Edge Function Template, fetch call
- **Flaw:** The fetch call uses `redirect: "follow"`. If an allowlisted origin (e.g., `www.company.com`) redirects to a non-allowlisted host, the edge function silently follows the redirect and serves the response from the non-allowlisted host. The allowlist check runs only on the initial `targetUrl`, not on the final destination after redirects.
- **Failure scenario:** An attacker constructs a URL to an allowlisted host that they control, which returns a 301 to an internal/private host (e.g., `http://169.254.169.254/latest/meta-data/` — AWS IMDS). The edge function follows the redirect and returns the metadata response. Even with external hosts, a compromised or misconfigured allowlisted domain could redirect to any arbitrary URL and the proxy would serve it, effectively becoming an open proxy for redirect chains.
- **Evidence:** `fetch(targetUrl, { redirect: "follow" })` — no post-redirect URL validation. The allowlist check at line 89 (`allowedHosts.includes(targetHost)`) only checks the initial hostname.
- **Suggested fix:** Change to `redirect: "manual"`. If a redirect response (3xx) is received, validate the Location header against the allowlist before following, or return an error.

---

## Finding 6: No Rollback Procedure — bypass_url Change Is Irreversible Under Failure
- **Severity:** High
- **Location:** Phase 3, "How to Set bypass_url in QRLive UI" / Phase 1, Risk Assessment
- **Flaw:** The plan has no rollback procedure. If the Japan proxy goes down, is blocked, or is misconfigured after bypass_url is set, Chinese users get errors. There is no documented "how to revert" — not even "clear the bypass_url field." Non-CN users are unaffected (they use target_url), but the CN segment silently breaks with no automated failover.
- **Failure scenario:** The Japan VPS IP gets blocked by GFW (listed as "High" risk in the plan's own Risk Assessment). All CN users scanning QR codes now get connection errors to `jp.company.com`. The proxy is down. The plan recommends "switch provider if blocked" — which requires: new VPS, DNS update, DNS propagation (hours), cert re-issuance. During this window, CN users have no working path. No documented emergency procedure to immediately fall back to direct target_url while the proxy is being rebuilt.
- **Evidence:** Risk row "VPS IP blocked by GFW: High — Use clean IP; switch provider if blocked" — no interim mitigation. Phase 3 "Step 7: Test by scanning QR code from China" has no mention of what to do if it fails at production launch.
- **Suggested fix:** Document explicit rollback: clear bypass_url in QRLive UI to fall back to target_url immediately. Add a documented runbook step. Consider a health-check-driven auto-disable of bypass_url via a cron or edge function that checks proxy health and clears the field if down.

---

## Finding 7: nginx Healthcheck Tests HTTP, Not HTTPS — Real Failure Mode Invisible
- **Severity:** Medium
- **Location:** Phase 1, Docker Compose `nginx` service `healthcheck`
- **Flaw:** The healthcheck is `curl -f http://localhost/health`. Port 80 serves only the ACME challenge handler and a 301 redirect. The health endpoint at `/health` returning 200 JSON is defined only in the `server { listen 443 ssl ... }` block. An HTTP request to `/health` will return 301, which `curl -f` treats as success (follows redirect by default). More critically: if SSL breaks (expired cert, missing cert file, misconfigured cipher), the container reports healthy while the actual proxy is down.
- **Failure scenario:** SSL cert expires (due to Finding 2 above). nginx drops all HTTPS connections. The Docker healthcheck still returns healthy because it tests HTTP port 80. External monitoring cron from Step 6 also tests HTTP (`curl -sf https://jp.company.com/health` — this one does use HTTPS, but the Docker health status shows healthy, masking the failure from orchestration tools and `docker ps` output).
- **Evidence:** `test: ["CMD", "curl", "-f", "http://localhost/health"]` — HTTP, port 80. The `/health` location block is inside the `listen 443 ssl` server block only.
- **Suggested fix:** Change healthcheck to `curl -fk https://localhost/health` (using `-k` to allow self-signed fallback) or move the `/health` endpoint to the HTTP (port 80) server block explicitly.

---

## Finding 8: No Log Rotation — VPS Disk Fills and nginx Stops
- **Severity:** Medium
- **Location:** Phase 1, "Hardening" / Docker Compose (no logging config)
- **Flaw:** The plan enables nginx access logging (`access.log for audit`) but specifies no log rotation and no Docker logging limits. On a $5/mo VPS with 10-25GB disk, nginx access logs for a proxy handling thousands of requests/day will fill the disk within weeks to months. When the disk is full, nginx cannot write logs and may stop processing requests.
- **Failure scenario:** VPS runs for 60 days with moderate traffic. `/var/lib/docker/containers/*/...json.log` or nginx's own access log fills the 25GB disk. nginx returns 502/503. The monitoring cron detects downtime and sends an email alert — but the alert email cannot be sent because the MTA also needs disk space. Operator SSHes in to find a full disk with no obvious cause.
- **Evidence:** No `logging:` configuration in docker-compose.yml. No `logrotate` setup in implementation steps. "Log access for audit: standard nginx access.log" — no rotation mentioned.
- **Suggested fix:** Add `logging: { driver: "json-file", options: { max-size: "10m", max-file: "3" } }` to the nginx service in docker-compose.yml. Alternatively, configure `logrotate` for nginx logs inside the container.

---

## Finding 9: Supabase Edge Function Exposed as HTTP Proxy with `Access-Control-Allow-Origin: *`
- **Severity:** Medium
- **Location:** Phase 2, Edge Function Template, `corsHeaders`
- **Flaw:** The function sets `Access-Control-Allow-Origin: *` globally, including on proxied responses that contain authentication tokens, session cookies, or sensitive API data. Any browser on any origin can make cross-origin requests to the proxy function and read the response. The secret key (`?key=SECRET`) does not mitigate this — once the key is known (Finding 4), any webpage can use the proxy to fetch allowlisted content on behalf of a user.
- **Failure scenario:** Secret key leaks (Finding 4 — it's in a URL, so it will). A malicious third-party website embeds JavaScript that calls the proxy endpoint, fetches data from an allowlisted API endpoint, and reads the response. `Access-Control-Allow-Origin: *` explicitly enables this cross-origin read. If the proxied API returns user-specific data (auth tokens, personal info), this is a data exfiltration vector.
- **Evidence:** `"Access-Control-Allow-Origin": "*"` in `corsHeaders` applied unconditionally to all responses including `return new Response(response.body, { status: response.status, headers })`.
- **Suggested fix:** Remove wildcard CORS from proxied content responses. Only include CORS headers on the OPTIONS preflight response. Or restrict to a specific trusted origin: `Access-Control-Allow-Origin: https://qrlive.vercel.app`.

---

## Unresolved Questions

1. How does the certbot container signal nginx to reload on successful renewal given they are in separate containers with no shared IPC? The plan has no answer.
2. The plan assumes `jp.company.com` throughout but "Unresolved Questions" in Phase 3 admits the actual domain is unknown — the entire nginx config and certbot commands are placeholders that will fail verbatim if copy-pasted.
3. No mention of VPS operating system update cadence — a `1 vCPU / 512MB RAM` machine running Docker without automated security updates is an attack surface.
4. Phase 2 deploys with `--no-verify-jwt` — this means any unauthenticated request reaches the function code. The only protection is the `?key=` parameter (Finding 4). If Supabase adds the function to the project's API, it is internet-accessible from day one.
