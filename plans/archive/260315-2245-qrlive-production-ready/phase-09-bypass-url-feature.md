# Phase 09 — Bypass URL Feature

**Priority:** 🟠 High | **Status:** Todo

> ⚠️ **[RED TEAM #5 — Critical] SCOPE CREEP WARNING:** This phase adds schema migration + edge function change + 4 UI components before core (Phases 01-08) is validated in production. Recommend deferring to v2. Phases 01+02+05+08 constitute a shippable MVP. Phase 09 introduces a 3rd URL-tier override that adds complexity before there are production users to need it. **Decision required:** defer or proceed with awareness of increased failure surface.

## Overview
Thêm field `bypass_url` vào `geo_routes`. Khi scan QR từ một quốc gia bị block (VN, CN, etc.), Edge Function ưu tiên redirect sang `bypass_url` thay vì `target_url`. App chỉ là **router thông minh** — user tự config mirror/proxy URL bên ngoài.

## Flow

```
QR scan
  → Edge Function
  → Detect country (cf-ipcountry)
  → Tìm geo_route match
  → geo_route có bypass_url? → redirect bypass_url  ✅
  → không có bypass_url?    → redirect target_url
  → không có geo_route?     → redirect default_url
```

## Tasks

### TASK-47: DB migration — thêm bypass_url
File mới: `supabase/migrations/YYYYMMDD_add_bypass_url.sql`
```sql
ALTER TABLE geo_routes ADD COLUMN bypass_url TEXT;
```
- [ ] Tạo migration file
- [ ] `supabase db push` để apply

### TASK-48: Update Supabase generated types
```bash
supabase gen types typescript --local > src/integrations/supabase/types.ts
```
- [ ] Chạy lại type gen sau migration

### TASK-49: Update Edge Function — bypass_url priority
File: `supabase/functions/redirect/index.ts`
- [ ] Sau khi match geo_route, check `bypass_url`:
  ```typescript
  // ⚠️ [RED TEAM #12 — Medium] BUG: ?? passes empty string "" through (nullish, not falsy).
  // Use || instead:
  const redirectTarget =
    matchedRoute?.bypass_url || matchedRoute?.target_url || link.default_url;

  // ⚠️ [RED TEAM #2 — Critical] OPEN REDIRECT: redirectTarget is raw DB value — validate before redirect.
  // Prevents javascript:, data:, file:// and private IP redirects (SSRF risk).
  try {
    const url = new URL(redirectTarget);
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Invalid protocol');
    // Optional: block private IP ranges (169.254.x.x, 10.x.x.x, 192.168.x.x, etc.)
  } catch {
    return new Response('Invalid redirect target', { status: 400 });
  }

  return Response.redirect(redirectTarget, 302);
  ```
- [ ] Log `bypass_used: true` trong click_event (thêm column hoặc dùng referer field tạm)

### TASK-50: Update db.ts interfaces
File: `src/lib/db.ts`
- [ ] Thêm `bypass_url?: string` vào `GeoRouteRow` interface
- [ ] `updateGeoRoutesInDB()` — include `bypass_url` trong INSERT payload

### TASK-51: UI — CreateLinkDialog, bypass_url field per geo route
File: `src/components/CreateLinkDialog.tsx`
- [ ] Mỗi geo route row thêm input "Bypass URL (tùy chọn)"
  - Placeholder: `https://mirror.example.com/...`
  - Tooltip/hint: "Dùng khi link gốc bị chặn ở quốc gia này"
- [ ] Collapsible — ẩn mặc định, click "⚙ Bypass" để mở rộng (tránh UI rối)
- [ ] Validate là URL hợp lệ nếu điền (optional field)

### TASK-52: UI — EditLinkDialog, bypass_url field per geo route
File: `src/components/EditLinkDialog.tsx`
- [ ] Tương tự TASK-51, pre-populate từ `existing route.bypass_url`

### TASK-53: UI — LinkCard, hiển thị badge bypass
File: `src/components/LinkCard.tsx`
- [ ] Geo route badge có `bypass_url` → hiển thị icon "🔀" hoặc badge "bypass" nhỏ
- [ ] Tooltip khi hover: "Có bypass URL"

### TASK-54: Update Zod schema
File: `src/lib/schemas.ts`
- [ ] `geoRouteSchema`: thêm `bypass_url: z.string().url().optional().or(z.literal(''))`

## Files Created
- `supabase/migrations/YYYYMMDD_add_bypass_url.sql`

## Files Modified
- `supabase/functions/redirect/index.ts`
- `src/lib/db.ts`
- `src/components/CreateLinkDialog.tsx`
- `src/components/EditLinkDialog.tsx`
- `src/components/LinkCard.tsx`
- `src/lib/schemas.ts`
- `src/integrations/supabase/types.ts` (re-generated)

## Example Config (User POV)

Ví dụ user tạo QR cho một trang bị block ở VN:

| Country | Target URL | Bypass URL |
|---------|-----------|------------|
| Vietnam | `https://example.com` | `https://translate.google.com/translate?sl=auto&tl=vi&u=https://example.com` |
| China | `https://example.com` | `https://web.archive.org/web/*/https://example.com` |
| (default) | `https://example.com` | — |

## Success Criteria
- Tạo geo route có bypass_url → save vào DB
- Scan QR từ VN (hoặc mock `cf-ipcountry: VN`) → Edge Function redirect sang bypass_url
- Scan QR từ US → redirect sang target_url (bypass_url bị ignore)
- bypass_url để trống → hoạt động như cũ
- Badge "bypass" hiển thị đúng trên LinkCard
