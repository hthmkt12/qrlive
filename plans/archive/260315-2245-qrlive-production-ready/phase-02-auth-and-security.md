# Phase 02 — Auth & Security

**Priority:** 🔴 Critical | **Status:** Todo

## Overview
Hiện tại app hoàn toàn public — bất kỳ ai cũng có thể xóa/sửa mọi QR link. Cần thêm auth để bảo vệ dữ liệu. Approach: **Supabase Auth (email/password)** + RLS policies per user.

## Tasks

### TASK-05: Supabase Auth setup
- [ ] Enable Email Auth trong Supabase dashboard (hoặc qua `supabase/config.toml`)
- [ ] Tạo migration mới: thêm `user_id UUID REFERENCES auth.users(id)` vào `qr_links`
  ```sql
  ALTER TABLE qr_links ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL;
  ```
<!-- Updated: Validation Session 1 - Greenfield confirmed, NOT NULL safe, no backfill needed -->

> ~~⚠️ **[RED TEAM #3 — Critical]**~~ **[RESOLVED by Validation]** Project is greenfield — no prior data. `NOT NULL` added directly. No backfill required. Existing rows will have `user_id = NULL`. RLS `USING (auth.uid() = user_id)` returns FALSE for NULLs → all pre-existing links become invisible and unmanageable (links still redirect via service role, but users cannot edit/delete). **Fix:** If greenfield, document it explicitly. If not, add a backfill step: assign orphaned rows to an admin user or use `NOT NULL` only after backfill. Add to migration:
> ```sql
> -- Option A (greenfield): assert no prior data
> -- Option B: backfill to a designated admin user_id before adding NOT NULL
> UPDATE qr_links SET user_id = '<admin-uuid>' WHERE user_id IS NULL;
> ALTER TABLE qr_links ALTER COLUMN user_id SET NOT NULL;
> ```

### TASK-06: Update RLS Policies
File: new migration `supabase/migrations/YYYYMMDD_rls_auth.sql`
- [ ] `qr_links`: chỉ owner mới đọc/sửa/xóa
  ```sql
  CREATE POLICY "owner_select" ON qr_links FOR SELECT USING (auth.uid() = user_id);
  CREATE POLICY "owner_insert" ON qr_links FOR INSERT WITH CHECK (auth.uid() = user_id);
  CREATE POLICY "owner_update" ON qr_links FOR UPDATE USING (auth.uid() = user_id);
  CREATE POLICY "owner_delete" ON qr_links FOR DELETE USING (auth.uid() = user_id);
  ```
- [ ] `geo_routes`: inherit qua link_id (join check)
  > ⚠️ **[RED TEAM #1 — Critical]** Placeholder only — no SQL written. Without an explicit policy, RLS on `geo_routes` either blocks all reads (deny-all default) or allows cross-user access (if RLS not enabled). **Fix:** Write the explicit policy:
  > ```sql
  > ALTER TABLE geo_routes ENABLE ROW LEVEL SECURITY;
  > CREATE POLICY "owner_select_geo_routes" ON geo_routes FOR SELECT
  >   USING (EXISTS (SELECT 1 FROM qr_links WHERE qr_links.id = geo_routes.link_id AND qr_links.user_id = auth.uid()));
  > CREATE POLICY "owner_insert_geo_routes" ON geo_routes FOR INSERT
  >   WITH CHECK (EXISTS (SELECT 1 FROM qr_links WHERE qr_links.id = geo_routes.link_id AND qr_links.user_id = auth.uid()));
  > CREATE POLICY "owner_update_geo_routes" ON geo_routes FOR UPDATE
  >   USING (EXISTS (SELECT 1 FROM qr_links WHERE qr_links.id = geo_routes.link_id AND qr_links.user_id = auth.uid()));
  > CREATE POLICY "owner_delete_geo_routes" ON geo_routes FOR DELETE
  >   USING (EXISTS (SELECT 1 FROM qr_links WHERE qr_links.id = geo_routes.link_id AND qr_links.user_id = auth.uid()));
  > ```
- [ ] `click_events`: insert public (edge fn cần insert), select chỉ owner
  ```sql
  -- [VALIDATION DECISION] Service role only — public_insert_clicks policy REMOVED.
  -- Edge function uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS.
  -- Public INSERT would allow any client to poison analytics via direct REST API.
  -- DO NOT add public_insert_clicks policy.
<!-- Updated: Validation Session 1 - Removed public_insert_clicks per service-role-only decision -->
  -- Chỉ owner xem analytics
  CREATE POLICY "owner_select_clicks" ON click_events FOR SELECT
    USING (EXISTS (SELECT 1 FROM qr_links WHERE qr_links.id = click_events.link_id AND qr_links.user_id = auth.uid()));
  ```

### TASK-07: AuthContext + AuthProvider
File mới: `src/contexts/auth-context.tsx`
- [ ] Tạo `AuthContext` với `user`, `session`, `signIn()`, `signOut()`, `signUp()`
- [ ] Wrap app trong `App.tsx`
- [ ] Listen `onAuthStateChange`

### TASK-08: AuthPage component
File mới: `src/pages/Auth.tsx`
- [ ] Form login/signup (toggle giữa 2 mode)
- [ ] Dùng `react-hook-form` + `zod` validation
- [ ] Show error messages
- [ ] Redirect về `/` sau login thành công

### TASK-09: Protected Routes
File: `src/App.tsx`
- [ ] Tạo `<ProtectedRoute>` wrapper — redirect về `/auth` nếu chưa login
- [ ] Route `/auth` → `Auth.tsx`
- [ ] Route `/` → Protected → `Index.tsx`

### TASK-10: Update db.ts — pass user_id khi create
File: `src/lib/db.ts`
- [ ] `createLinkInDB()` nhận `userId: string`, insert kèm `user_id`
- [ ] `fetchLinks()` query chỉ links của current user (RLS tự lọc nếu dùng Supabase client với session)

### TASK-11: Header — user info + logout button
File: `src/pages/Index.tsx`
- [ ] Hiển thị email user hiện tại
- [ ] Nút "Đăng xuất"

## Files Created
- `src/contexts/auth-context.tsx`
- `src/pages/Auth.tsx`
- `supabase/migrations/YYYYMMDD_rls_auth.sql`

## Files Modified
- `src/App.tsx` — add ProtectedRoute, auth route
- `src/lib/db.ts` — pass user_id
- `src/pages/Index.tsx` — show user, logout

## Success Criteria
- Unauthenticated user không thể truy cập `/` (redirect về `/auth`)
- User A không thể xem/sửa/xóa links của User B
- Edge function `redirect` vẫn hoạt động public (không cần auth)
- Login/logout flow hoạt động
