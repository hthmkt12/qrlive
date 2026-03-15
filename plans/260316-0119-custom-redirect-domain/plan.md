# Custom Redirect Domain

**Date:** 2026-03-16 | **Status:** Ready to implement
**Complexity:** Simple — 3 files, no DB migration

---

## Problem

QR codes hiện trỏ vào `supabase.co/functions/v1/redirect/CODE`.
`supabase.co` có thể bị block bởi GFW Trung Quốc → QR không hoạt động.

## Solution

Thêm env var `VITE_REDIRECT_BASE_URL` để operator cấu hình domain riêng.
Khi không set → fallback về Supabase URL mặc định (backward compatible).

```
Trước: QR → supabase.co/functions/v1/redirect/CODE
Sau:   QR → yourdomain.com/r/CODE  (custom domain, accessible từ TQ)
```

## Architecture

```
[QR Code] → [yourdomain.com/r/CODE]
                ↓ Cloudflare Worker / HK Server proxy
            [supabase.co/functions/v1/redirect/CODE]
                ↓
            [Geo-routing logic + redirect]
```

Custom domain có thể là:
- Cloudflare Worker (nếu TQ chưa block)
- Alibaba Cloud Function Compute (100% accessible từ TQ)
- Hong Kong VPS (reliable)
- Bất kỳ proxy nào accessible từ TQ

## Phase Overview

| # | Phase | File | Status |
|---|-------|------|--------|
| 1 | [Env var + getRedirectUrl](./phase-01-env-and-redirect-url.md) | `src/lib/db.ts`, `.env.example` | Todo |
| 2 | [Cloudflare Worker proxy](./phase-02-cloudflare-worker.md) | `cloudflare-worker/redirect-proxy.js` (new) | Todo |
| 3 | [Deploy guide](./phase-03-deploy-guide.md) | `docs/deployment-guide.md` | Todo |
