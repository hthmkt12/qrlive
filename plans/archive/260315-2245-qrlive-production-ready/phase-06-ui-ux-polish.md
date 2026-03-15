# Phase 06 — UI/UX Polish

**Priority:** 🟡 Medium | **Status:** Todo

## Overview
App đang chỉ có dark mode, không responsive tốt trên mobile, thiếu empty states và loading skeletons. Polish để dùng thực tế tốt hơn.

## Tasks

### TASK-27: Loading skeletons
File: `src/pages/Index.tsx`
- [ ] Khi `isLoading = true` → render 3 `<Skeleton>` cards thay vì màn hình trắng
- [ ] Dùng shadcn `<Skeleton>` component (đã có trong `ui/`)

### TASK-28: Empty state
File: `src/pages/Index.tsx`
- [ ] Khi `links.length === 0` và không loading → hiển thị empty state
- [ ] Icon QR lớn + text "Chưa có QR nào. Tạo mới ngay!" + button "Tạo QR mới"

### TASK-29: Mobile layout
File: `src/pages/Index.tsx`, `src/components/LinkCard.tsx`
- [ ] Stats bar: wrap xuống 2 hàng trên mobile (hiện tại 4 items ngang có thể overflow)
- [ ] LinkCard: ẩn bớt geo route badges trên mobile (chỉ show count), show đầy đủ trên desktop
- [ ] Header: ẩn tagline strip trên mobile

### TASK-30: StatsPanel back navigation
File: `src/components/StatsPanel.tsx`
- [ ] Thêm button "← Quay lại" ở đầu StatsPanel để về danh sách
- [ ] Hiện tại chỉ có thể back bằng cách reload page (UX tệ)

### TASK-31: Confirm dialog trước khi xóa
File: `src/components/LinkCard.tsx`
- [ ] Wrap delete action trong `<AlertDialog>` confirm
- [ ] Text: "Xóa QR này? Tất cả dữ liệu click sẽ bị mất vĩnh viễn."

### TASK-32: Copy link toast feedback
File: `src/components/QRPreview.tsx`
- [ ] Sau khi copy link → toast "Đã copy link!" (hiện tại không có feedback)
- [ ] Thay đổi icon button thành checkmark trong 2 giây sau khi copy

### TASK-33: Light/Dark theme toggle
File: `src/App.tsx`, `src/index.css`, `src/pages/Index.tsx`
- [ ] Wire up `next-themes` `ThemeProvider` đúng cách
- [ ] Thêm light mode CSS variables vào `src/index.css`
- [ ] Thêm theme toggle button (sun/moon icon) ở header

## Files Modified
- `src/pages/Index.tsx`
- `src/components/LinkCard.tsx`
- `src/components/StatsPanel.tsx`
- `src/components/QRPreview.tsx`
- `src/App.tsx`
- `src/index.css`

## Success Criteria
- Loading state có skeleton, không flash trắng
- Empty state rõ ràng với call-to-action
- App dùng được trên iPhone SE (375px width)
- Xóa link có confirm dialog
- Copy link có visual feedback
