# Phase 01 — Cleanup & Config

**Priority:** 🔴 Critical | **Status:** Todo

## Overview
Xóa dead code, fix hardcoded URLs, setup env vars đúng cách. Đây là nền tảng cho mọi phase tiếp theo.

## Tasks

### TASK-01: Xóa dead code
- [ ] Xóa `src/lib/store.ts` (localStorage prototype, không ai import)
- [ ] Xóa `src/components/NavLink.tsx` (không dùng)
- [ ] Xóa interfaces `QRLink`, `GeoRoute`, `ClickEvent` trong `src/lib/types.ts` (duplicate của db.ts)
  - Giữ lại `COUNTRIES` array

### TASK-02: Fix hardcoded Supabase URL
File: `src/lib/db.ts`
- [ ] Thay `https://mapcpkxjmxltvgkgrurz.supabase.co/functions/v1/redirect/` bằng `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/redirect/`

### TASK-03: Tạo .env.example
File mới: `.env.example`
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```
- [ ] Tạo `.env.example`
- [ ] Kiểm tra `.gitignore` đã có `.env*` entry chưa

### TASK-04: Xóa unused dependencies
- [ ] Chạy `bun remove vaul cmdk embla-carousel-react react-resizable-panels input-otp date-fns`
- [ ] Giữ lại `next-themes`, `react-hook-form`, `zod`, `@tanstack/react-query` (sẽ dùng ở phase sau)

## Files Modified
- `src/lib/store.ts` → DELETE
- `src/components/NavLink.tsx` → DELETE
- `src/lib/types.ts` → remove dead interfaces
- `src/lib/db.ts` → fix hardcoded URL
- `.env.example` → CREATE
- `package.json` → remove unused deps

## Success Criteria
- Build passes sau cleanup
- Không còn hardcoded project URL
- Repo không có file `.env` thật được commit
