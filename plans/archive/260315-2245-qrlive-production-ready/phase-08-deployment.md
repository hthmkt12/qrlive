# Phase 08 — Deployment & Env Setup

**Priority:** 🔴 Critical | **Status:** Todo

## Overview
Setup môi trường deploy thực tế. Recommended: **Vercel** (frontend) + **Supabase** (backend đã có). Edge function deploy lên Supabase.

## Tasks

### TASK-40: Environment variables
- [ ] Tạo `.env.local` (không commit) với:
  ```
  VITE_SUPABASE_URL=https://mapcpkxjmxltvgkgrurz.supabase.co
  VITE_SUPABASE_ANON_KEY=<your-anon-key>
  ```
- [ ] Verify app chạy local với `bun dev`

### TASK-40.5: Pre-deployment backup (NEW — Red Team addition)
> ⚠️ **[RED TEAM #8 — High]** The plan pushes schema migrations to production mid-plan (before Phases 03-07 are implemented), with no rollback path. If Phases 03-07 introduce bugs discovered after the migration is live, rolling back the DB schema requires a down migration on a live DB with real data. **Fix:** Always backup before pushing, define down migrations, use a staging Supabase project.
```bash
# Backup production DB before any schema change
supabase db dump -f backup-$(date +%Y%m%d).sql --linked
```
- [ ] Run `supabase db dump` and store backup
- [ ] Write down migrations for each Phase 02 schema change (reverse of `ALTER TABLE` statements)
- [ ] Consider using a staging Supabase project to verify migrations before production push

### TASK-41: Deploy Supabase migrations
```bash
supabase db push
```
- [ ] Push migration auth RLS (Phase 02)
- [ ] Verify tables + policies đúng trên Supabase dashboard

### TASK-42: Deploy Edge Function
```bash
supabase functions deploy redirect --no-verify-jwt
```
- [ ] Verify function live tại `https://<project>.supabase.co/functions/v1/redirect/<code>`
- [ ] Test redirect với valid short code

### TASK-43: Deploy Frontend lên Vercel
- [ ] `vercel` CLI hoặc connect GitHub repo
- [ ] Set env vars trên Vercel dashboard:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- [ ] Verify production build: `bun run build` → không có errors

### TASK-44: Custom domain (optional)
- [ ] Nếu có domain: add CNAME trên Vercel
- [ ] Update Supabase Auth Redirect URLs với production domain

### TASK-45: vercel.json — SPA routing
File mới: `vercel.json`
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```
- [ ] Tạo file này để prevent 404 khi refresh trên `/auth` hay sub-routes

### TASK-46: Build check script
File: `package.json`
- [ ] Verify `build` script: `tsc -b && vite build`
- [ ] Add `typecheck` script: `tsc --noEmit` (nhanh hơn để CI)

## Files Created
- `.env.example` (đã có từ Phase 01)
- `vercel.json`

## Files Modified
- `package.json` — thêm typecheck script

## Commands
```bash
# Local verify
bun install && bun run build

# Supabase
supabase db push
supabase functions deploy redirect --no-verify-jwt

# Vercel
vercel --prod
```

## Success Criteria
- `bun run build` thành công, không TypeScript errors
- Production URL hoạt động: login, tạo QR, scan QR → redirect đúng
- Redirect edge function trả < 500ms (không có ip-api.com call)
- Scan QR từ điện thoại → redirect đến đúng URL theo quốc gia
