---
phase: 1
title: "Japan VPS nginx Reverse Proxy"
status: pending
priority: P1
effort: 3h
---

# Phase 1: Japan VPS nginx Reverse Proxy

## Context Links

- [Redirect edge function](../../supabase/functions/redirect/index.ts) — line 94 uses bypass_url
- [plan.md](./plan.md) — overview

## Overview

Deploy an nginx reverse proxy on a Japan VPS that forwards requests to the user's actual content server. Chinese users hit `jp.company.com` (Japan) which proxies to `www.company.com` (origin). Japan is not blocked by GFW and has low latency to both China and most origin servers.

## Requirements

### Functional
- Reverse proxy HTTP/HTTPS traffic to configurable upstream origin
- SSL termination with auto-renewing Let's Encrypt certificates
- Health check endpoint at `/health`
- Support multiple upstream domains via server blocks
- Docker Compose deployment for reproducibility

### Non-Functional
- Response time: <200ms added latency over direct connection
- Uptime: 99.9% (VPS SLA dependent)
- Security: not an open proxy — allowlist enforced

## Architecture

```
Internet (CN users)
    |
    v
[Japan VPS - Tokyo]
    |
    +--> nginx:443 (SSL termination)
    |       |
    |       +--> proxy_pass to origin server
    |
    +--> certbot (auto-renew SSL)
    |
    +--> /health (200 OK)
```

## VPS Provider Recommendations

| Provider | Region | Min Spec | Monthly Cost |
|----------|--------|----------|-------------|
| Vultr | Tokyo | 1 vCPU, 1GB RAM | ~$6 |
| Linode | Tokyo | 1 vCPU, 1GB RAM (Nanode) | ~$5 |
| AWS Lightsail | ap-northeast-1 | 1 vCPU, 512MB RAM | ~$3.50 |
| ConoHa | Tokyo | 1 vCPU, 512MB RAM | ~$4 |

**Recommendation:** Vultr or Linode for simplicity. AWS Lightsail if already in AWS ecosystem.

## nginx Configuration Template

```nginx
# /etc/nginx/conf.d/proxy.conf

# Rate limiting zone — 10 req/s per IP
limit_req_zone $binary_remote_addr zone=proxy_limit:10m rate=10r/s;

# Upstream allowlist — ONLY proxy to these domains
# Add each target domain as a separate upstream block
upstream origin_company {
    server www.company.com:443;
}

server {
    listen 80;
    server_name jp.company.com;

    # ACME challenge for Let's Encrypt
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name jp.company.com;

    ssl_certificate /etc/letsencrypt/live/jp.company.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/jp.company.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options SAMEORIGIN;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Health check
    location /health {
        access_log off;
        return 200 '{"status":"ok","server":"jp-proxy"}';
        add_header Content-Type application/json;
    }

    # Reverse proxy to origin
    location / {
        limit_req zone=proxy_limit burst=20 nodelay;

        proxy_pass https://www.company.com;
        proxy_set_header Host www.company.com;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 10s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;

        # Buffer settings
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;

        # Do NOT cache by default (origin controls caching)
        proxy_no_cache 1;
        proxy_cache_bypass 1;
    }

    # Block common abuse paths
    location ~* ^/(wp-admin|wp-login|xmlrpc|.env|.git) {
        return 404;
    }
}
```

## Docker Compose Setup

```yaml
# docker-compose.yml
version: "3.8"

services:
  nginx:
    image: nginx:1.25-alpine
    container_name: jp-proxy-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - certbot-webroot:/var/www/certbot:ro
      - certbot-certs:/etc/letsencrypt:ro
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/health"]
      interval: 30s
      timeout: 5s
      retries: 3

  certbot:
    image: certbot/certbot:latest
    container_name: jp-proxy-certbot
    volumes:
      - certbot-webroot:/var/www/certbot
      - certbot-certs:/etc/letsencrypt
    # Initial cert: run manually first time
    # Renewal: cron or entrypoint loop
    entrypoint: >
      sh -c "trap exit TERM;
      while :; do
        certbot renew --webroot -w /var/www/certbot --quiet;
        sleep 12h & wait $${!};
      done"
    restart: unless-stopped

volumes:
  certbot-webroot:
  certbot-certs:
```

## Implementation Steps

### Step 1: Provision VPS
1. Create Tokyo-region VPS (1 vCPU, 1GB RAM minimum)
2. Set up SSH key access, disable password auth
3. Install Docker + Docker Compose
4. Configure firewall: allow 80, 443, 22 only

### Step 2: DNS Setup
1. Point `jp.company.com` A record to VPS IP
2. Wait for DNS propagation (check with `dig jp.company.com`)

### Step 3: Initial SSL Certificate
```bash
# First time only — get certificate before nginx starts with SSL
docker compose run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d jp.company.com \
  --agree-tos --email admin@company.com --non-interactive
```

### Step 4: Deploy nginx
```bash
# Clone config repo or scp files to VPS
docker compose up -d
# Verify
curl -I https://jp.company.com/health
```

### Step 5: Configure QRLive bypass_url
1. In QRLive UI, edit link > CN geo-route
2. Set bypass_url to `https://jp.company.com/path`
3. Test: use VPN from China or `curl -H "cf-ipcountry: CN"` against Supabase edge function

### Step 6: Monitoring Setup
```bash
# Simple uptime check via cron on another server
*/5 * * * * curl -sf https://jp.company.com/health || echo "JP proxy down" | mail -s "Alert" admin@company.com
```

## Adding More Domains

To proxy multiple target domains, add server blocks:

```nginx
# /etc/nginx/conf.d/proxy-site2.conf
server {
    listen 443 ssl http2;
    server_name jp-site2.company.com;

    ssl_certificate /etc/letsencrypt/live/jp-site2.company.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/jp-site2.company.com/privkey.pem;
    # ... same SSL settings ...

    location / {
        proxy_pass https://site2.company.com;
        proxy_set_header Host site2.company.com;
        # ... same proxy settings ...
    }
}
```

Then re-run certbot for the new domain and `docker compose restart nginx`.

## Security Considerations

### Open Proxy Prevention
- Each server block has a hardcoded `proxy_pass` target — NOT user-supplied
- No `$http_host` or `$arg_url` in proxy_pass (prevents abuse)
- Unknown Host header returns nginx default 444 (connection closed)

### Rate Limiting
- 10 req/s per IP with burst of 20
- Adjust based on traffic patterns
- Consider adding `limit_conn` for concurrent connection limits

### Firewall Rules
```bash
# UFW example
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP (redirect + ACME)
ufw allow 443/tcp   # HTTPS
ufw enable
```

### Hardening
- Disable nginx version disclosure: `server_tokens off;`
- Drop requests with no Host header
- Log access for audit: standard nginx access.log

## What This CANNOT Do

| Scenario | Works? | Why |
|----------|--------|-----|
| Proxy own landing page | Yes | Full control over content and headers |
| Proxy own file downloads | Yes | Static content, no auth issues |
| Proxy own SPA (React/Vue) | Partial | Works if API calls also go through proxy |
| Proxy Facebook/Instagram | No | OAuth redirects, cookie domains, CSP |
| Proxy Google services | No | Heavy JS, auth, reCAPTCHA |
| Proxy YouTube videos | No | DRM, adaptive streaming, auth |

## Success Criteria

- [ ] VPS provisioned in Tokyo region
- [ ] DNS `jp.company.com` resolves to VPS IP
- [ ] SSL certificate obtained and auto-renewing
- [ ] `curl https://jp.company.com/health` returns 200
- [ ] Proxied content matches origin content
- [ ] Rate limiting blocks >10 req/s from single IP
- [ ] QRLive bypass_url redirect works end-to-end from CN
- [ ] Docker Compose restarts cleanly after VPS reboot

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| VPS IP blocked by GFW | High | Use clean IP; switch provider if blocked |
| Origin server blocks Japan VPS IP | Medium | Allowlist VPS IP on origin firewall |
| SSL cert expiry | Medium | Certbot auto-renew + monitoring alert |
| VPS overloaded | Low | Upgrade plan; nginx handles 10K+ concurrent easily |
| Domain `jp.company.com` blocked | Low | Use less obvious subdomain; have backup domain ready |
