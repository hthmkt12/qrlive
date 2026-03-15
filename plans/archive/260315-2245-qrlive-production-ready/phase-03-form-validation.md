# Phase 03 — Form Validation & Data Integrity

**Priority:** 🟠 High | **Status:** Todo

## Overview
Hiện tại tất cả forms dùng `useState` thuần, không validate. react-hook-form + zod đã được install — dùng chúng để validate đúng cách và handle short code collision.

## Tasks

### TASK-12: Zod schemas
File mới: `src/lib/schemas.ts`
- [ ] `geoRouteSchema`: `{ country_code: z.string().length(2), target_url: z.string().url() }`
- [ ] `createLinkSchema`: `{ name: z.string().min(1).max(100), default_url: z.string().url(), geo_routes: z.array(geoRouteSchema).optional() }`
- [ ] `editLinkSchema`: same fields, all optional (PATCH semantics)
- [ ] `authSchema`: `{ email: z.string().email(), password: z.string().min(8) }`

### TASK-13: Refactor CreateLinkDialog
File: `src/components/CreateLinkDialog.tsx`
- [ ] Thay `useState` form state bằng `useForm<CreateLinkInput>()` từ react-hook-form
- [ ] Validate với `zodResolver(createLinkSchema)`
- [ ] Hiển thị field-level error messages dưới mỗi input
- [ ] Disable submit button khi form invalid hoặc đang loading

### TASK-14: Refactor EditLinkDialog
File: `src/components/EditLinkDialog.tsx`
- [ ] Tương tự TASK-13, dùng `editLinkSchema`
- [ ] Pre-populate giá trị từ existing link via `reset(link)` khi dialog mở

### TASK-15: Fix short code collision
File: `src/lib/db.ts`
- [ ] Tạo helper `generateUniqueShortCode(supabase)` — thử insert, nếu bị unique violation thì retry tối đa 5 lần với code mới
- [ ] Hoặc đơn giản hơn: generate server-side trong Supabase function/trigger (khuyến nghị)

### TASK-16: URL validation ở Edge Function
File: `supabase/functions/redirect/index.ts`
- [ ] Validate `shortCode` format trước khi query DB (chỉ accept `[A-Z0-9]{6}`)
- [ ] Return 400 nếu format sai thay vì query DB

## Files Created
- `src/lib/schemas.ts`

## Files Modified
- `src/components/CreateLinkDialog.tsx`
- `src/components/EditLinkDialog.tsx`
- `src/lib/db.ts`
- `supabase/functions/redirect/index.ts`

## Success Criteria
- Submit URL không hợp lệ → hiển thị lỗi ngay dưới field, không gọi API
- Name để trống → field error
- Short code collision không crash app
- Edge function trả 400 với short code format sai
