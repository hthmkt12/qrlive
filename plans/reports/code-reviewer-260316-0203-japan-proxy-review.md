# Code Review: QRLive Japan Proxy Feature

**Date:** 2026-03-16
**Reviewer:** code-reviewer agent
**Score: 7.5 / 10**

---

## Scope

| File | LOC | Notes |
|------|-----|-------|
| japan-proxy/docker-compose.yml | 43 | Container orchestration |
| japan-proxy/nginx/nginx.conf | 43 | Base nginx config |
| japan-proxy/nginx/conf.d/proxy-template.conf | 89 | Site template |
| japan-proxy/setup.sh | 91 | VPS bootstrap script |
| supabase/functions/proxy/index.ts | 105 | Edge function proxy |

Total reviewed: ~371 LOC

---

## Overall Assessment

The implementation is solid for a reverse-proxy / GFW-bypass use-case. Open proxy prevention is correctly handled in both layers (nginx: hardcoded `proxy_pass`; Edge Function: allowlist + secret key). Most security fundamentals are present. Issues below are fixable without redesign.

---

## Critical Issues

### C1. `setup.sh`: Unvalidated shell inputs (command injection risk)
**File:** `setup.sh` lines 8-9, 52, 66-71

`$DOMAIN` and `$EMAIL` are accepted from CLI args and used in:
- `sed` substitution (line 52): `sed "s/jp\.company\.com/$DOMAIN/g"`
- `docker compose run` args (lines 66-71): passed directly to certbot `-d "$DOMAIN"` and `--email "$EMAIL"`

A `$DOMAIN` value of e.g. `foo.com/;rm -rf /` or `foo.com$(whoami)` would be dangerous. The `sed` substitution is double-quoted but still substitutes shell metacharacters before `sed` sees them.

**Fix:**
```bash
# Add input validation immediately after the emptiness check (after line 15)
if [[ ! "$DOMAIN" =~ ^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$ ]]; then
  echo "Error: DOMAIN must be a valid hostname (e.g. jp.company.com)"
  exit 1
fi
if [[ ! "$EMAIL" =~ ^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$ ]]; then
  echo "Error: EMAIL must be a valid email address"
  exit 1
fi
```

---

### C2. `nginx.conf`: Default SSL server references placeholder cert that won't exist on first boot
**File:** `nginx.conf` lines 35-38

```nginx
server {
    listen 443 ssl default_server;
    ssl_certificate /etc/letsencrypt/live/placeholder/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/placeholder/privkey.pem;
    return 444;
}
```

Nginx will **fail to start** if this path does not exist. On fresh VPS before certbot runs, the `placeholder` cert does not exist, so the container crashes in a loop — making the ACME HTTP challenge unreachable, creating a chicken-and-egg deadlock.

**Fix (two options):**

Option A — Generate a self-signed cert at setup time and mount it:
```bash
# In setup.sh, before docker compose up -d nginx
mkdir -p nginx/certs/placeholder
openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
  -keyout nginx/certs/placeholder/privkey.pem \
  -out nginx/certs/placeholder/fullchain.pem \
  -subj "/CN=placeholder"
```
Then add volume `./nginx/certs:/etc/letsencrypt/live:ro` to nginx service.

Option B — Remove the `443 ssl` default server block entirely; the HTTP-only default server (`return 444`) is sufficient for blocking unknown hosts pre-cert. Add the SSL default back only after the cert exists.

---

## High Priority Issues

### H1. `proxy-template.conf`: Missing HSTS preload + weak cipher suite
**File:** `proxy-template.conf` lines 27-29, 37

```nginx
ssl_ciphers HIGH:!aNULL:!MD5;
```
`HIGH` is broad and includes 3DES (SWEET32 vulnerability). Use an explicit modern list:
```nginx
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256;
```

HSTS header (line 37) should also include `preload` if the domain will be submitted to the browser preload list:
```nginx
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
```

### H2. `index.ts`: Secret key transmitted in query string — logged in plaintext
**File:** `supabase/functions/proxy/index.ts` lines 33-34

```typescript
const targetUrl = url.searchParams.get("url");
const key = url.searchParams.get("key");
```

Query parameters are logged in:
- Supabase Edge Function invocation logs
- Any CDN/proxy access logs between client and Supabase
- Browser history and server-side referer headers when `?key=` is in the URL

**Fix:** Accept the secret in a request header instead:
```typescript
const key = req.headers.get("x-proxy-key");
```
Client usage: `fetch(proxyUrl, { headers: { "x-proxy-key": SECRET } })`

### H3. `index.ts`: CORS allows `*` — should be origin-restricted for production
**File:** `index.ts` lines 21-24

```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  ...
};
```

Since this endpoint requires a secret key, setting `*` is lower risk, but it still allows any origin to attempt calls. If the secret leaks, any site can exploit the proxy.

**Fix:**
```typescript
const allowedOrigins = (Deno.env.get("PROXY_ALLOWED_ORIGINS") || "").split(",").map(s => s.trim());
const origin = req.headers.get("Origin") || "";
const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || "";
const corsHeaders = {
  "Access-Control-Allow-Origin": corsOrigin,
  "Vary": "Origin",
  ...
};
```

### H4. `index.ts`: No subdomain matching in allowlist — overly strict or bypassable
**File:** `index.ts` lines 54-72

Allowlist uses exact `hostname` match (`allowedHosts.includes(targetHost)`). This means:
- `files.company.com` must be listed separately from `www.company.com` — good (explicit is safer).
- However, an attacker can bypass with `www.company.com.evil.com` — **not** a risk here because `new URL().hostname` correctly returns `www.company.com.evil.com`, which won't match.

The real gap: no protection against **SSRF to internal/private IPs**. A user with the key could supply `http://169.254.169.254/` (AWS metadata), `http://10.0.0.1/`, etc. The allowlist only checks the hostname string — it doesn't block IP literals.

**Fix:** Add an IP literal check before the allowlist:
```typescript
const parsedTarget = new URL(targetUrl);
const hostname = parsedTarget.hostname;
// Block IP literals and private ranges
if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname === "localhost" || hostname.endsWith(".local")) {
  return new Response(JSON.stringify({ error: "Host not allowed" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
```

---

## Medium Priority Issues

### M1. `docker-compose.yml`: certbot container runs as root, no resource limits
The certbot container has no `user:`, `mem_limit:`, or `cpus:` constraints. For a hardened production deployment add:
```yaml
certbot:
  user: "1000:1000"   # or create a certbot user
  mem_limit: 64m
  cpus: "0.1"
```
Note: certbot may need root to write to `/etc/letsencrypt` — if so, drop to a non-root approach using a read/write split volume or certbot's `--deploy-hook`.

### M2. `proxy-template.conf`: `X-XSS-Protection` header is deprecated
**File:** line 36

`X-XSS-Protection "1; mode=block"` is deprecated in all modern browsers and can actually introduce XSS vulnerabilities in old IE. Replace with a proper `Content-Security-Policy`:
```nginx
# Remove this:
# add_header X-XSS-Protection "1; mode=block";

# Add this (adjust src values to match origin):
add_header Content-Security-Policy "default-src 'self' https://www.company.com; frame-ancestors 'none';" always;
```

### M3. `proxy-template.conf`: Rate limit `burst=20 nodelay` may be too permissive
**File:** line 58

`nodelay` with burst=20 means a single IP can fire 20 requests instantaneously before rate limiting kicks in. For a GFW-bypass proxy (expected low-volume legitimate traffic), a burst of 5-10 with `delay` rather than `nodelay` is safer:
```nginx
limit_req zone=proxy_limit burst=5 delay=2;
```

### M4. `proxy-template.conf`: Health endpoint returns `200` without auth — information disclosure minor risk
**File:** lines 44-48

The `/health` endpoint returns `{"status":"ok","server":"jp-proxy"}` publicly. The `server` key reveals internal naming. Consider returning just `{"status":"ok"}` or restricting to internal/monitoring IPs.

### M5. `setup.sh`: Docker installed via pipe-to-sh (supply chain risk)
**File:** line 25

```bash
curl -fsSL https://get.docker.com | sh
```

This is the standard pattern and fine for a trusted environment, but best practice is to pin the Docker version or verify the script hash. Worth documenting as a known acceptable risk in the setup comments.

### M6. `index.ts`: `error` in catch block is typed `unknown` in Deno/TS — unsafe `.message` access
**File:** line 99

```typescript
} catch (error) {
  console.error("Proxy fetch error:", error);
```

No `.message` access here, so it's safe as written. But the generic `error` variable should be typed:
```typescript
} catch (error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  console.error("Proxy fetch error:", msg);
```

---

## Low Priority Issues

### L1. `nginx.conf`: `worker_connections 1024` may be low for high-traffic proxy
Default is fine for a small proxy but worth noting — tune with `worker_rlimit_nofile` and `use epoll` for production load.

### L2. `proxy-template.conf`: `proxy_pass_header Set-Cookie` unnecessary
`proxy_pass_header Set-Cookie` (line 87) is not needed — nginx passes `Set-Cookie` from upstream by default. This directive is a no-op but creates visual confusion.

### L3. `setup.sh`: No version pinning for nginx image
`nginx:1.25-alpine` is version-pinned at minor level but not digest-pinned. For reproducible deploys, consider pinning by digest: `nginx:1.25-alpine@sha256:<digest>`.

### L4. `docker-compose.yml`: certbot uses `latest` tag
```yaml
image: certbot/certbot:latest
```
Use a pinned version (e.g., `certbot/certbot:v3.0.1`) for reproducible builds.

### L5. `proxy-template.conf`: Missing `ssl_stapling`
Add OCSP stapling to reduce TLS handshake latency:
```nginx
ssl_stapling on;
ssl_stapling_verify on;
resolver 8.8.8.8 1.1.1.1 valid=300s;
resolver_timeout 5s;
```

---

## Edge Cases / Scout Findings

1. **First-boot deadlock (see C2)**: nginx won't start without certs; certbot can't get certs without nginx serving ACME challenge. setup.sh partially addresses this by starting nginx first (HTTP only), but the `443 ssl default_server` block in `nginx.conf` prevents startup.

2. **Cert renewal race**: The `certbot renew` loop runs every 12h; nginx is never reloaded after renewal. The container restart policy `unless-stopped` won't help here. Add a `--deploy-hook` or a sidecar that sends `nginx -s reload` after successful renewal:
   ```yaml
   # In certbot entrypoint, after certbot renew:
   certbot renew --webroot -w /var/www/certbot --deploy-hook "docker exec jp-proxy-nginx nginx -s reload" --quiet
   ```
   Without this, the new cert is written to disk but nginx continues serving the old (potentially expired) cert until manual restart.

3. **`setup.sh` runs `docker compose up -d` twice** (lines 63 and 79): line 79 (`docker compose up -d`) is redundant after `docker compose restart nginx` on line 78. Harmless but confusing.

4. **Template config still contains placeholder origin** (`www.company.com`) after `sed` substitution: `sed` only replaces `jp.company.com` (the proxy domain), not the origin. The script correctly prints `IMPORTANT: Edit $CONF_FILE and set the correct proxy_pass origin!` (line 54). This is documented but easy to miss — consider making setup.sh fail-fast if the `proxy_pass` is still the placeholder after setup.

5. **`index.ts` `redirect: "follow"`**: If the upstream server at an allowed host redirects to a disallowed host, the fetch will follow the redirect and serve content from the disallowed host. Consider `redirect: "manual"` and return the redirect to the client, or re-validate the final URL.

---

## Positive Observations

- Open proxy is correctly prevented: `proxy_pass` is hardcoded in nginx (not user-supplied); Edge Function enforces allowlist + secret key before any upstream fetch.
- Default server block correctly returns `444` for unknown `Host` headers — prevents host header injection probing.
- ACME challenge location correctly placed in HTTP server block (before redirect to HTTPS).
- `set -euo pipefail` in setup.sh is good shell hygiene.
- `proxy_redirect` header rewriting (line 70) correctly remaps upstream redirects from the origin domain to the proxy domain.
- Rate limiting zones defined in base config (shared across all vhosts).
- `server_tokens off` hides nginx version.
- Edge function correctly checks `PROXY_ALLOWED_HOSTS` is non-empty — refuses to act as open proxy if misconfigured.
- `no-verify-jwt` deploy is noted with explanation — intentional and documented.

---

## Recommended Actions (Prioritized)

1. **[C2] Fix nginx first-boot deadlock** — generate placeholder self-signed cert in `setup.sh` before `docker compose up -d nginx`, or remove the `443 ssl default_server` block from `nginx.conf` and add it only after cert exists.
2. **[C1] Validate `$DOMAIN` and `$EMAIL` inputs in `setup.sh`** — add regex guard after line 15.
3. **[H2] Move secret key from query param to `x-proxy-key` header** in Edge Function — prevents key leaking in logs.
4. **[H4] Add SSRF protection** in Edge Function — block IP literals and private hostnames before allowlist check.
5. **[Edge#2] Fix cert renewal reload** — add `--deploy-hook "docker exec jp-proxy-nginx nginx -s reload"` to certbot entrypoint.
6. **[H1] Tighten TLS cipher suite** — replace `HIGH:!aNULL:!MD5` with explicit modern cipher list.
7. **[M2] Remove `X-XSS-Protection`** and add a `Content-Security-Policy` header.
8. **[L4] Pin certbot image version** — replace `latest` with a pinned tag.

---

## Metrics

| Metric | Value |
|--------|-------|
| Critical issues | 2 |
| High issues | 4 |
| Medium issues | 6 |
| Low issues | 5 |
| Edge cases found | 5 |
| Open proxy prevention | Correctly implemented in both layers |
| Test coverage | None (infra/config — n/a) |

---

## Unresolved Questions

1. Is the Supabase Edge Function intended as a permanent fallback or strictly dev/testing? The comment says "testing/fallback only" but the code is production-quality — clarify which env vars are actually set in production.
2. Will the Japan VPS be behind a cloud firewall (e.g., AWS Security Group) in addition to ufw? If yes, the ufw step is redundant but harmless.
3. Should the proxy strip or preserve `Authorization` headers from the client when forwarding to origin? Currently neither nginx nor the Edge Function forwards auth headers — intentional?
4. Is `client_max_body_size 10m` sufficient if the proxied site allows file uploads larger than 10MB?
