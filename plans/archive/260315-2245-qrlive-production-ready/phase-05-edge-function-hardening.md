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

> ⚠️ **[RED TEAM #10 — High]** `cf-ipcountry` is only trustworthy when the request routes through Cloudflare. Callers hitting the Supabase functions URL directly (bypassing Cloudflare) can send a spoofed `cf-ipcountry: US` header to bypass geo-routing. **Fix:** Document this limitation explicitly. If geo-routing bypass is a security concern (not just content targeting), add a Cloudflare Worker as the entry point that strips and re-sets `cf-ipcountry` before proxying to Supabase.

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

### TASK-25.5: Rate limiting (NEW — Red Team addition)
File: `supabase/functions/redirect/index.ts`
> ⚠️ **[RED TEAM #11 — High]** The redirect endpoint is unauthenticated and public. Without rate limiting, attackers can enumerate all 6-char short codes (sequential generation is common) to harvest all redirect URLs. **Fix:** Add Cloudflare rate limiting rule (100 req/min per IP) on the redirect path, OR add an application-level check using Supabase's `pg_notify`/Redis. At minimum, document the exposure so ops is aware.
- [ ] Configure Cloudflare rate limiting: 100 requests/min per IP on `*/functions/v1/redirect/*`
- [ ] Alternatively: set `X-RateLimit-*` headers as signals for upstream proxies

### TASK-26: Supabase service role cho edge fn
File: `supabase/functions/redirect/index.ts`
- [ ] Dùng `SUPABASE_SERVICE_ROLE_KEY` env var (Supabase inject tự động) để init client trong edge fn
- [ ] Đảm bảo click_events INSERT bypass RLS (service role bypass RLS)
- [ ] **[RED TEAM #4]** Remove `public_insert_clicks` policy from Phase 02 if service role is used — having both means any unauthenticated client can INSERT arbitrary click_events directly via the Supabase REST API (bypassing the edge function entirely).
- [ ] Create `supabase/functions/.env.example` with `SUPABASE_SERVICE_ROLE_KEY=` for local dev (not auto-injected by `supabase functions serve`)

## Files Modified
- `supabase/functions/redirect/index.ts`

## Success Criteria
- Redirect hoạt động không phụ thuộc `ip-api.com`
- Bot requests không tạo click events giả
- Link inactive → 404, không redirect
- Không còn external HTTP call trong redirect path (latency giảm ~200-500ms)
