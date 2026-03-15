# Phase 2: Cloudflare Worker Proxy

**File:** `cloudflare-worker/redirect-proxy.js` (mới, không phải trong src/)

## Mục đích

Proxy nhẹ chạy trên Cloudflare Workers/HK server.
Nhận request `yourdomain.com/r/CODE` → forward đến Supabase Edge Function.

## Code

```js
// Cloudflare Worker: redirect-proxy.js
// Deploy tại: workers.cloudflare.com
// Route: yourdomain.com/r/*

const SUPABASE_REDIRECT_URL = "https://YOUR_PROJECT.supabase.co/functions/v1/redirect";

export default {
  async fetch(request) {
    const url = new URL(request.url);
    // Extract short code from path: /r/CODE → CODE
    const shortCode = url.pathname.split("/").pop();

    if (!shortCode) {
      return new Response("Not found", { status: 404 });
    }

    // Forward to Supabase with original headers (preserves cf-ipcountry)
    const targetUrl = `${SUPABASE_REDIRECT_URL}/${shortCode}`;
    return fetch(targetUrl, {
      headers: request.headers,
      method: request.method,
    });
  },
};
```

## Quan trọng: giữ cf-ipcountry header

Khi proxy, phải forward `cf-ipcountry` header từ request gốc.
Nếu không, Supabase sẽ không biết user đang ở quốc gia nào → geo-routing sai.

Code trên dùng `headers: request.headers` → tự động forward tất cả headers bao gồm `cf-ipcountry`. ✅

## Deploy

```bash
# Install Wrangler CLI
npm install -g wrangler

# Login
wrangler login

# Deploy
wrangler deploy cloudflare-worker/redirect-proxy.js \
  --name qrlive-redirect \
  --route "r.yourdomain.com/*"
```

## Sau khi deploy

Set env var trong Vercel:
```
VITE_REDIRECT_BASE_URL=https://r.yourdomain.com
```

Redeploy frontend → QR codes mới sẽ dùng custom domain.

## Lưu ý về GFW

- Cloudflare Workers: **không guaranteed** accessible từ TQ. Cloudflare IPs bị block lẻ tẻ.
- Nếu cần 100% reliable → dùng Alibaba Cloud Function Compute hoặc Hong Kong VPS thay thế.
- Logic proxy hoàn toàn giống nhau, chỉ thay platform.
