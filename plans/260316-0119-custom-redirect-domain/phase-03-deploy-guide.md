# Phase 3: Deploy Guide Update

**File:** `docs/deployment-guide.md`

## Section to add: "China Accessibility"

Thêm vào cuối deployment-guide.md:

```markdown
## China Accessibility (Custom Redirect Domain)

Nếu cần QR codes hoạt động từ Trung Quốc (Great Firewall), cần custom domain.

### Option A: Cloudflare Workers (nhanh, miễn phí, nhưng không guaranteed ở TQ)
1. Deploy `cloudflare-worker/redirect-proxy.js` lên Cloudflare Workers
2. Gán route: `r.yourdomain.com/*`
3. Set `VITE_REDIRECT_BASE_URL=https://r.yourdomain.com/r` trong Vercel
4. Redeploy frontend

### Option B: Alibaba Cloud Function Compute (100% accessible từ TQ)
1. Tạo Function Compute function tại Alibaba Cloud
2. Deploy code tương tự redirect-proxy.js
3. Gán custom domain Alibaba tới function
4. Set `VITE_REDIRECT_BASE_URL` và redeploy

### Option C: Hong Kong VPS (reliable, cần maintain server)
1. Cài nginx + node trên HK VPS
2. Forward `/r/:code` → `supabase.co/functions/v1/redirect/:code`
3. Set `VITE_REDIRECT_BASE_URL=https://r.yourdomain.com/r` và redeploy

### Test GFW blocking
- blockedinchina.net — kiểm tra URL có bị block không
- ping từ VPS HK để test connectivity
```
