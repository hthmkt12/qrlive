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
- [ ] ~~Tạo helper `generateUniqueShortCode(supabase)` — thử insert, nếu bị unique violation thì retry tối đa 5 lần với code mới~~
- [ ] **[RED TEAM #6 — High] MANDATE server-side approach only.** Client-side retry is a TOCTOU race: two concurrent clients generate the same code, both check SELECT (both see empty), both INSERT → one fails after all retries. Use a Postgres function:
  ```sql
  CREATE OR REPLACE FUNCTION generate_short_code() RETURNS TEXT AS $$
  DECLARE
    chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    code TEXT;
  BEGIN
    LOOP
      code := '';
      FOR i IN 1..6 LOOP
        code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
      END LOOP;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM qr_links WHERE short_code = code);
    END LOOP;
    RETURN code;
  END;
  $$ LANGUAGE plpgsql;
  ```
  Set as column default: `ALTER TABLE qr_links ALTER COLUMN short_code SET DEFAULT generate_short_code();`

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
