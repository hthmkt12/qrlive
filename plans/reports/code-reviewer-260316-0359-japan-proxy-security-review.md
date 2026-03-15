---
title: "Security Review: Japan Reverse Proxy Server for GFW Bypass"
reviewer: code-reviewer
date: 2026-03-16
plan: plans/260316-0155-japan-proxy-server/
severity-summary: 2 Critical, 3 High, 3 Medium
---

# Security Review: Japan Reverse Proxy Server for GFW Bypass

## Scope
- Files: plan.md, phase-01-vps-nginx.md, phase-02-supabase-proxy-edge.md, phase-03-integration-guide.md
- Perspective: Security Adversary (attacker mindset)
- Focus: auth bypass, injection, data exposure, privilege escalation, SSRF, supply chain

---

## Finding 1: SSRF via Redirect-Following in Phase 2 Edge Function

- **Severity:** Critical
- **Location:** Phase 2, "Edge Function Template" — `fetch(targetUrl, { redirect: "follow" })`
- **Flaw:** The edge function validates the `targetUrl` hostname against an allowlist, then fetches it with `redirect: "follow"`. An allowlisted origin can issue a 3xx redirect to any arbitrary destination — including `http://169.254.169.254/` (AWS metadata), internal Supabase infrastructure IPs, or other internal services. The allowlist check happens only on the *initial* URL, not on redirect destinations.
- **Failure scenario:** Attacker controls `www.company.com` (or compromises it), adds a redirect to `http://169.254.169.254/latest/meta-data/iam/security-credentials/`. The edge function follows the redirect, reads AWS IAM credentials from the metadata service, and returns them to the attacker as the proxied response body.
- **Evidence:** `redirect: "follow"` with no post-redirect host re-validation. The allowlist check at line 88-93 is bypassed entirely once a redirect occurs.
- **Suggested fix:** Set `redirect: "manual"`, check the `Location` header on 3xx responses against the allowlist before following, or simply return the 3xx to the client and let the browser follow it.

---

## Finding 2: Secret Key Exposed in QR Code / bypass_url (Phase 2)

- **Severity:** Critical
- **Location:** Phase 2, "Architecture" section and Phase 3, "How to Set bypass_url" step 5
- **Flaw:** The `PROXY_SECRET` is embedded as a plaintext query parameter in the `bypass_url` value stored in the `geo_routes` database table and displayed in the QRLive UI. This URL is also encoded into QR codes that are publicly distributed to Chinese users. Anyone who scans the QR code, inspects the redirect, or reads the `bypass_url` from the database (e.g., via a compromised QRLive account or a misconfigured RLS policy) immediately has the proxy secret.
- **Failure scenario:** A user photographs the QR code, decodes it, and extracts `?key=SECRET`. They can now use the proxy as a full open proxy against all allowlisted hosts — at the operator's cost and with their identity. Alternatively, an attacker with read access to `geo_routes` (even a non-admin user if RLS is misconfigured) harvests every secret in the table.
- **Evidence:** `https://PROJECT.supabase.co/functions/v1/proxy?url=https://www.company.com/page&key=SECRET` — this is the documented bypass_url format. The QR code encodes this exact URL.
- **Suggested fix:** Use a request-signing scheme (HMAC-SHA256 of `url+timestamp`, short TTL) rather than a static shared secret in the URL. Alternatively, issue the secret only to the server-side redirect function and have the edge function verify a caller token from Supabase Auth rather than a URL parameter.

---

## Finding 3: X-Forwarded-For Header Spoofing / IP Reputation Laundering (Phase 1)

- **Severity:** High
- **Location:** Phase 1, nginx configuration — `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for`
- **Flaw:** `$proxy_add_x_forwarded_for` appends the client IP to any existing `X-Forwarded-For` header the client sends. A client can inject arbitrary IPs into this header. The origin server receives a `X-Forwarded-For` chain like `10.0.0.1, 192.168.1.1, <real-client-IP>`. Origin servers that trust the first IP in the chain for rate limiting, geo-blocking, or fraud detection will be deceived. This also allows bypassing IP-based bans on the origin.
- **Failure scenario:** An attacker behind the proxy sets `X-Forwarded-For: 127.0.0.1` in their request. The origin server sees `X-Forwarded-For: 127.0.0.1, <attacker-real-IP>` and interprets the request as coming from localhost, potentially bypassing IP-based access controls on the origin.
- **Evidence:** `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` — no sanitization of incoming XFF header before appending.
- **Suggested fix:** Use `proxy_set_header X-Forwarded-For $remote_addr;` to discard any client-supplied XFF and only forward the actual connecting IP. Or set `real_ip_header X-Forwarded-For` with `set_real_ip_from` restricted to trusted upstream ranges.

---

## Finding 4: No Request Size or Body Limits — DoS / Cost Amplification (Phase 1 and Phase 2)

- **Severity:** High
- **Location:** Phase 1, nginx configuration (no `client_max_body_size`); Phase 2, edge function (no body size check)
- **Flaw:** Phase 1 nginx config has no `client_max_body_size` directive. Default nginx limit is 1MB, but there is no explicit configuration, and the plan's templates show no body restriction. An attacker can POST multi-gigabyte payloads to the proxy. For Phase 2, Supabase's 6MB limit is mentioned but not enforced in the function code itself — and there is no timeout on the upstream `fetch()`, only Deno's platform 25s limit. A slow-read attack against a slow origin can hold open all available edge function slots.
- **Failure scenario (Phase 1):** Attacker sends concurrent 1GB POST requests to the proxy. nginx buffers them, consuming all disk/memory on the 512MB-1GB VPS, causing OOM kill or disk full, taking down the proxy.
- **Failure scenario (Phase 2):** Attacker crafts a request to a slow allowlisted origin (or an attacker-controlled allowlisted origin that trickles data). 100 concurrent requests × 25s = all Supabase concurrency slots consumed, function unavailable for legitimate users, and cost spikes.
- **Evidence:** No `client_max_body_size` in Phase 1 config. No `signal: AbortSignal.timeout(N)` in Phase 2 fetch call.
- **Suggested fix:** Add `client_max_body_size 10m;` in nginx. Add `signal: AbortSignal.timeout(20000)` to the Phase 2 fetch call. Add `limit_conn` to Phase 1 alongside existing `limit_req`.

---

## Finding 5: `certbot:latest` — Supply Chain / Unpinned Image (Phase 1)

- **Severity:** High
- **Location:** Phase 1, "Docker Compose Setup" — `image: certbot/certbot:latest`
- **Flaw:** The certbot container is pinned to `latest` while nginx is pinned to `1.25-alpine`. `certbot:latest` will pull whatever the upstream registry serves at deploy time. A compromised or updated certbot image could exfiltrate private keys from the `/etc/letsencrypt` shared volume, which the certbot container has read-write access to. Since the certs volume is shared with nginx, key theft = full TLS impersonation of the proxy domain.
- **Failure scenario:** A supply chain incident in the `certbot/certbot` Docker Hub image pushes a backdoored `latest` tag. On the next VPS reboot or `docker compose pull`, the VPS pulls the malicious image. The certbot container reads `privkey.pem` from the shared volume and exfiltrates it. The attacker can now perform MITM on all traffic to `jp.company.com`.
- **Evidence:** `image: certbot/certbot:latest` — no digest pinning, no version tag.
- **Suggested fix:** Pin to a specific version with digest: `image: certbot/certbot:v2.11.0@sha256:<digest>`. Consider using Traefik or Caddy which handle cert issuance natively with a single, well-audited image.

---

## Finding 6: Supabase Function Deployed with `--no-verify-jwt` Removes Supabase-Level Auth (Phase 2)

- **Severity:** High
- **Location:** Phase 2, "Deployment" — `supabase functions deploy proxy --no-verify-jwt`
- **Flaw:** `--no-verify-jwt` disables Supabase's built-in JWT verification, meaning anyone on the internet can invoke the function without a Supabase auth token. The only defense is the `PROXY_SECRET` query parameter — which, per Finding 2, is exposed in QR codes. If the secret is compromised (highly likely), there is zero authentication layer remaining. Supabase's own rate limiting applies per-project but is not documented as a defense here.
- **Failure scenario:** Secret is extracted from a QR code (see Finding 2). Attacker now has unlimited access to the proxy function with no auth, rate limiting only from Supabase's permissive platform defaults. Attacker uses it to hammer allowlisted origin servers, generating bandwidth costs and potentially triggering abuse complaints against the operator's Supabase account.
- **Evidence:** `supabase functions deploy proxy --no-verify-jwt` — explicitly disabling the only platform-level auth gate.
- **Suggested fix:** Remove `--no-verify-jwt`. Require a valid Supabase anon key or service role JWT. The redirect edge function (the only legitimate caller) already has access to these credentials and can include them in the proxy request.

---

## Finding 7: `Access-Control-Allow-Origin: *` on Proxy Endpoint Enables Cross-Origin Data Exfiltration (Phase 2)

- **Severity:** Medium
- **Location:** Phase 2, "Edge Function Template" — `corsHeaders = { "Access-Control-Allow-Origin": "*" }`
- **Flaw:** The proxy function returns `Access-Control-Allow-Origin: *` on all responses, including the proxied content body. Any malicious website loaded in a victim's browser can make a cross-origin `fetch()` to the proxy endpoint (with the stolen secret), read the response body of any allowlisted origin, and exfiltrate it. This turns the proxy into a same-origin bypass for allowlisted hosts.
- **Failure scenario:** Attacker embeds `<script>fetch('https://PROJECT.supabase.co/functions/v1/proxy?url=https://internal-api.company.com/users&key=SECRET').then(r=>r.text()).then(d=>exfiltrate(d))</script>` on a page. Victim loads the page while authenticated to internal-api.company.com. The proxy fetches the internal API response and returns it with `ACAO: *`, allowing the attacker's script to read it.
- **Evidence:** `"Access-Control-Allow-Origin": "*"` applied to all responses including proxied content.
- **Suggested fix:** Restrict CORS to the specific QRLive origin (`https://qrlive.vercel.app`) or remove CORS headers entirely since the proxy is intended for server-side redirect use, not browser-side fetch.

---

## Finding 8: Health Endpoint Fingerprints Infrastructure for GFW Scanners (Phase 1)

- **Severity:** Medium
- **Location:** Phase 1, nginx configuration — `return 200 '{"status":"ok","server":"jp-proxy"}';`
- **Flaw:** The `/health` endpoint returns `"server":"jp-proxy"` with no authentication. GFW active probing infrastructure routinely scans IP ranges and identifies proxy/VPN servers by their responses. A distinctive JSON fingerprint makes automated identification trivial. Once identified as a proxy server, the VPS IP is a candidate for blocking.
- **Failure scenario:** GFW scanner hits `https://jp.company.com/health`, receives `{"status":"ok","server":"jp-proxy"}`, tags the IP as a proxy server infrastructure. IP gets added to the GFW blocklist within days/weeks, defeating the entire purpose of the service.
- **Evidence:** `return 200 '{"status":"ok","server":"jp-proxy"}';` — the `"server":"jp-proxy"` label is a self-identifying fingerprint.
- **Suggested fix:** Return a generic `{"status":"ok"}` or better, make the health endpoint require a secret header or be accessible only from the monitoring IP. Remove the `"server"` field entirely.

---

## Finding 9: No Mutual TLS or Origin Authentication — Proxy Can Be Rerouted (Phase 1)

- **Severity:** Medium
- **Location:** Phase 1, "Security Considerations / Open Proxy Prevention" and nginx config
- **Flaw:** The plan states "hardcoded proxy_pass targets" as the open-proxy prevention mechanism. However, the nginx config connects to the upstream with `proxy_pass https://www.company.com` and a matching `Host` header, but there is no certificate pinning or verification that the upstream TLS certificate matches an expected fingerprint. DNS hijacking of `www.company.com` from the VPS's resolver, or a BGP hijack of the origin IP, causes the proxy to silently forward all traffic to an attacker-controlled server — including any authentication cookies or POST bodies passed through.
- **Failure scenario:** Attacker compromises the DNS resolver used by the Japan VPS (e.g., via a poisoned 8.8.8.8 response or a compromised VPS-level DNS). `www.company.com` resolves to the attacker's server. All traffic proxied through the Japan VPS is now forwarded to the attacker, who reads cookies, POST bodies, and session tokens from Chinese users' requests. nginx's default TLS verification checks the cert but not against a pinned key — a CA-issued cert for `www.company.com` from any CA satisfies the check.
- **Evidence:** No `proxy_ssl_trusted_certificate`, no `proxy_ssl_verify`, no pinned upstream fingerprint in the nginx config template.
- **Suggested fix:** Add `proxy_ssl_verify on;` and `proxy_ssl_trusted_certificate /path/to/origin-ca.pem;` to the nginx proxy block. Use the origin's own CA bundle. Document that the VPS DNS should be configured to use a trusted resolver (e.g., `1.1.1.1` explicitly, not relying on VPS provider's default).

---

## Unresolved Questions

1. Who has write access to `geo_routes.bypass_url`? If any authenticated user can set arbitrary bypass_url values, this is a stored-XSS vector in the QRLive UI (browsers follow the 302 to attacker-controlled URLs).
2. Does the redirect edge function validate or sanitize `bypass_url` before issuing the 302? If not, `javascript:` scheme or `data:` URI bypass_url values could execute in the QR scanner's webview.
3. Is the VPS provisioned under a shared hosting account or a dedicated VPS account? Shared hosting means another tenant's compromise exposes this proxy's private keys and config.
4. Is there any logging of proxy requests that could reveal the `?key=SECRET` query parameter in server access logs or Supabase function logs?
