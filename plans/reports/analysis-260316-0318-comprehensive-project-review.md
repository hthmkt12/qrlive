# QRLive — Báo Cáo Phân Tích Toàn Diện
**Date:** 2026-03-16 | **Branch:** master | **Agents:** Codebase Explorer + Security Reviewer + Roadmap Analyzer

---

## Executive Summary

QRLive là một SPA React 18 + TypeScript production-ready cho quản lý QR code link với geo-routing. MVP đã hoàn tất và deployed. Kiến trúc tốt, nhưng có **1 bug nghiêm trọng** (custom short code bị broken ở redirect), **1 lỗ hổng bảo mật HIGH** (click_events insert policy quá permissive), và **0% test coverage** cho business components.

**Overall:** ✅ Production-Ready MVP | ⚠️ Post-MVP features cần fix trước khi ổn định

---

## 1. Kiến Trúc Tổng Thể

```
Frontend (Vercel)                    Backend (Supabase)
├─ React 18 SPA                      ├─ Postgres DB + RLS
├─ TanStack React Query v5           ├─ Auth (JWT)
├─ Vite + TypeScript                 ├─ Edge Functions (Deno)
├─ shadcn/ui (45 Radix components)   └─ RLS Policies (owner-only)
└─ Tailwind CSS

QR Scan → Cloudflare Worker (proxy) → Supabase Edge /redirect
        → Geo-resolve (bypass > target > default) → 302
```

**Luồng dữ liệu chính:**
1. **Create/Update** → React Hook Form (Zod) → React Query mutation → Supabase RPC → Cache invalidation
2. **Analytics** → RPC `get_link_click_summaries()` + `get_link_click_detail()` → StatsPanel
3. **Redirect** → Cloudflare Worker → Edge Function → geo-detect → INSERT click_events → 302

---

## 2. Trạng Thái MVP

| Phase | Status |
|-------|--------|
| Cleanup & Config | ✅ Complete |
| Auth & Security | ✅ Complete |
| Form Validation | ✅ Complete |
| React Query Migration | ✅ Complete |
| Edge Function Hardening | ✅ Complete |
| UI/UX Polish | ✅ Complete |
| Testing (33 tests) | ✅ Complete |
| Deployment (Vercel + Supabase) | ✅ Live |
| Bypass URL Feature | ✅ Complete |

**Post-MVP đang triển khai:**
- Custom Short Codes — deployed nhưng **broken** (xem Issue #1)
- QR Code Customization — in progress
- Custom Redirect Base URL — scaffolded

---

## 3. Vấn Đề Nghiêm Trọng (Cần Fix Ngay)

### 🔴 [CRITICAL] Custom Short Code Redirect Broken
**File:** `supabase/functions/redirect/index.ts`

Short code được lưu đúng nhưng bị reject khi redirect:
- Schema cho phép: `[A-Za-z0-9_-]{3,20}` (3–20 ký tự, có dấu gạch)
- Redirect validator yêu cầu: `^[A-Z0-9]{6}$` (chính xác 6 ký tự uppercase)
- **Kết quả:** Custom codes → HTTP 400 khi scan QR

**Fix:** Cập nhật regex trong edge function thành `^[A-Z0-9_-]{3,20}$`

---

## 4. Bảo Mật

### 🔴 HIGH — click_events INSERT quá permissive
```sql
CREATE POLICY "click_events_insert_public" ON public.click_events
  FOR INSERT WITH CHECK (true);  -- BẤT KỲ AI cũng có thể insert!
```
Bất kỳ client anon nào có thể spam analytics của user khác. Fix: Chỉ cho phép service role insert.

### 🟠 HIGH — Supabase project URL hardcoded trong Cloudflare Worker
```js
const SUPABASE_REDIRECT_URL = "https://ybxmpuirarncxmenprzf.supabase.co/...";
```
Project subdomain lộ trong version control nếu repo public. Fix: Dùng `wrangler.toml` env var.

### 🟠 HIGH — Không validate custom short code trước khi insert vào DB
`db.ts` chỉ trim + uppercase, không validate regex → malformed code được lưu nhưng fail ở redirect.

### 🟡 MEDIUM — SSRF risk trong proxy/index.ts
Không có guard cho private IP ranges (169.254.x.x, localhost, 10.x.x.x) nếu `PROXY_ALLOWED_HOSTS` bị misconfigure.

### 🟡 MEDIUM — Referer không truncate
Raw `Referer` header lưu thẳng vào DB, không có giới hạn độ dài → 10KB/click.

### 🟡 MEDIUM — user_id nullable trong qr_links
Rows với `user_id = NULL` invisible với mọi user, không cleanup được.

### 🟡 MEDIUM — geo_routes insert error bị swallow
```ts
await supabase.from("geo_routes").insert(routes); // Không check error!
```
Link được tạo nhưng geo-routes fail silently → data inconsistency.

### 🟢 Tốt
- ✅ RLS enforced toàn diện (owner-only)
- ✅ SQL injection không có (parameterized queries)
- ✅ URL protocol validation (`javascript:`, `data:` blocked)
- ✅ Rate limiting 1 click/IP/60s
- ✅ Bot filtering (analytics sạch)
- ✅ JWT managed by Supabase client

---

## 5. Test Coverage

| Layer | Files | Tests | Status |
|-------|-------|-------|--------|
| Schemas (Zod) | schemas.ts | 17 | ✅ |
| DB utilities | db.ts | 7 (partial) | ⚠️ |
| Auth context | auth-context.tsx | 8 | ✅ |
| Components | LinkCard, CreateLink, EditLink, StatsPanel, QRPreview | 0 | ❌ |
| Mutations hooks | use-link-mutations.ts | 0 | ❌ |
| Edge function | redirect/index.ts | 0 | ❌ |

**Tổng:** 33/33 passing | ~66% coverage (target: 80%)

**Vấn đề phụ:** Test pattern `^[A-Z0-9]{6}$` không khớp với schema thực tế `^[A-Z0-9_-]{3,20}$` → false confidence.

---

## 6. Code Quality

### Files > 200 lines (cần theo dõi)
| File | Lines | Ghi chú |
|------|-------|---------|
| `src/lib/db.ts` | 248 | Nên split: db-queries / db-mutations / db-analytics |
| `src/pages/Index.tsx` | 196 | Biên giới, OK |

### Performance
- `analyticsByLinkId` Map được rebuild mỗi render → wrap trong `useMemo`
- `formatDayLabel` dùng local timezone → nên dùng `T00:00:00Z`
- Bundle size ~350KB gzipped (cần code-splitting cho StatsPanel charts)

---

## 7. Metrics

| Metric | Target | Hiện tại | Status |
|--------|--------|----------|--------|
| Test Coverage | >80% | ~66% | ⚠️ |
| Redirect Latency | <100ms | ~50ms | ✅ |
| Page Load (FCP) | <2s | ~1.5s | ✅ |
| Build Time | <30s | ~10s | ✅ |
| Uptime | 99.9% | 100% (new) | ✅ |

---

## 8. Kế Hoạch Hành Động

### Ngay lập tức (P0)
1. Fix redirect validator `^[A-Z0-9_-]{3,20}$` — custom codes đang broken
2. Add regex validation cho custom short code trong `db.ts` trước khi insert
3. Restrict `click_events` INSERT policy về service role only
4. Fix geo_routes insert error handling trong `createLinkInDB`

### Tuần tới (P1)
5. Externalize Supabase URL sang Cloudflare Worker env var
6. Truncate referer header ≤500 chars trước khi lưu
7. Add SSRF guard trong `proxy/index.ts`
8. Cập nhật test pattern `^[A-Z0-9_-]{3,20}$`
9. Wrap `analyticsByLinkId` trong `useMemo`

### Sprint tiếp theo (P2)
10. Thêm 20-30 component tests (LinkCard, CreateLink, EditLink, StatsPanel)
11. Thêm mutation hook tests
12. Test edge function redirect logic
13. Split `db.ts` → db-queries / db-mutations / db-analytics

### Dài hạn (P3)
14. E2E tests với Playwright (infrastructure đã có)
15. Code splitting cho bundle optimization
16. Pagination nếu link list > 500 items

---

## Unresolved Questions

1. Repo có public không? Nếu có, HIGH-1 (Supabase URL) cần rotate ngay.
2. `proxy` Edge Function có deployed production chưa? Nếu có, SSRF (MEDIUM-5) cần ưu tiên cao hơn.
3. Có rows `user_id = NULL` trong production không? Cần backfill/cleanup migration.
4. DB-level constraints cho `name` và `default_url` max length có tồn tại không?
5. E2E tests với Playwright có nằm trong roadmap gần không?
