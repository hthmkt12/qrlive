# Phase 05 — Edge Function Hardening

**Priority:** 🟠 High | **Status:** Todo

## Overview
Edge function `redirect` dùng `ip-api.com` free tier (45 req/min limit) không có error handling. Cần harden để hoạt động ổn dưới load thực tế.

## Tasks

### TASK-22: Replace ip-api.com với Cloudflare header
File: `supabase/functions/redirect/index.ts`
- [ ] `cf-ipcountry` header đã được parse — **ưu tiên dùng cái này** (Cloudflare cung cấp miễn phí, không rate limit)
- [ ] Xóa fallback gọi `ip-api.com` — gây latency + unreliable
- [ ] Nếu `cf-ipcountry` không có (local dev), gracefully fallback về `default_url` thay vì crash

### TASK-23: Handle inactive links
File: `supabase/functions/redirect/index.ts`
- [ ] Nếu `is_active = false` → return 404 với JSON `{ error: "Link not found or inactive" }`
- [ ] Nếu `short_code` không tồn tại → return 404

### TASK-24: Rate limiting headers
File: `supabase/functions/redirect/index.ts`
- [ ] Thêm response headers: `Cache-Control: no-store`, `X-Robots-Tag: noindex`
- [ ] Thêm `Vary: Accept-Language` (optional, SEO-friendly)

### TASK-25: Click event — dedup bot traffic
File: `supabase/functions/redirect/index.ts`
- [ ] Check `user_agent` — skip insert nếu match common bot patterns: `bot|crawler|spider|prerender|headless`
- [ ] Regex case-insensitive check trước khi INSERT

### TASK-26: Supabase service role cho edge fn
File: `supabase/functions/redirect/index.ts`
- [ ] Dùng `SUPABASE_SERVICE_ROLE_KEY` env var (Supabase inject tự động) để init client trong edge fn
- [ ] Đảm bảo click_events INSERT bypass RLS (service role bypass RLS)

## Files Modified
- `supabase/functions/redirect/index.ts`

## Success Criteria
- Redirect hoạt động không phụ thuộc `ip-api.com`
- Bot requests không tạo click events giả
- Link inactive → 404, không redirect
- Không còn external HTTP call trong redirect path (latency giảm ~200-500ms)
