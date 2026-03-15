# Phase 02 — Auth & Security

**Priority:** 🔴 Critical | **Status:** Todo

## Overview
Hiện tại app hoàn toàn public — bất kỳ ai cũng có thể xóa/sửa mọi QR link. Cần thêm auth để bảo vệ dữ liệu. Approach: **Supabase Auth (email/password)** + RLS policies per user.

## Tasks

### TASK-05: Supabase Auth setup
- [ ] Enable Email Auth trong Supabase dashboard (hoặc qua `supabase/config.toml`)
- [ ] Tạo migration mới: thêm `user_id UUID REFERENCES auth.users(id)` vào `qr_links`
  ```sql
  ALTER TABLE qr_links ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  ```

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
- [ ] `click_events`: insert public (edge fn cần insert), select chỉ owner
  ```sql
  -- Edge function insert không cần auth (service role hoặc public)
  CREATE POLICY "public_insert_clicks" ON click_events FOR INSERT WITH CHECK (true);
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
