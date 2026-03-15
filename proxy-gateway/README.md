# Proxy Gateway

Always-on HTTPS gateway for QRLive `bypass_url` traffic.

## What it does

- Accepts browser requests on a public domain such as `https://jp.yourdomain.com`
- Forwards them to one fixed `UPSTREAM_ORIGIN`
- Sends outbound traffic through `OUTBOUND_PROXY_URL`
- Supports `http`, `https`, `socks5`, and `socks5h` proxy vendors
- Exposes `/health` for Fly.io or other health checks

## Environment

Copy `.env.example` and set:

- `UPSTREAM_ORIGIN`: origin site to mirror through the gateway
- `OUTBOUND_PROXY_URL`: vendor proxy URL, for example `socks5://user:pass@host:1080`
- `PORT`: local listen port, defaults to `8080`
- `REQUEST_TIMEOUT_MS`: upstream timeout, defaults to `30000`
- `MAX_REDIRECTS`: defaults to `0` so upstream redirects are passed through

## Local run

```bash
cd proxy-gateway
npm install
npm run test
npm run dev
```

## QRLive usage

Use the deployed gateway URL in `bypass_url`, for example:

```text
Target URL: https://www.company.com/page
Bypass URL: https://jp.yourdomain.com/page
```

## Deployment notes

- `fly.toml.example` keeps one machine always on
- set secrets in Fly for the proxy credentials if they are not embedded in `OUTBOUND_PROXY_URL`
- keep one gateway per origin host unless you intentionally want to multiplex traffic
