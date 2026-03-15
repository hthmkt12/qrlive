# Phase 04 — React Query Migration

**Priority:** 🟠 High | **Status:** Todo

## Overview
`@tanstack/react-query` đã install + `QueryClientProvider` đã mount nhưng không dùng. Hiện tại `Index.tsx` dùng `useState` + manual `setInterval(refresh, 10000)`. Migrate sang React Query để có caching, background refetch, loading/error states chuẩn.

## Tasks

### TASK-17: Query keys constants
File mới: `src/lib/query-keys.ts`
- [ ] `QUERY_KEYS = { links: ['links'] as const, link: (id: string) => ['links', id] as const }`

### TASK-18: useLinks hook
File mới: `src/hooks/use-links.ts`
- [ ] `useLinks()` — dùng `useQuery({ queryKey: QUERY_KEYS.links, queryFn: fetchLinks, refetchInterval: 10_000 })`
- [ ] Returns `{ links, isLoading, error, refetch }`

### TASK-19: useLinkMutations hook
File mới: `src/hooks/use-link-mutations.ts`
- [ ] `useCreateLink()` — `useMutation({ mutationFn: createLinkInDB, onSuccess: () => queryClient.invalidateQueries(QUERY_KEYS.links) })`
- [ ] `useUpdateLink()` — invalidate on success
- [ ] `useDeleteLink()` — invalidate on success + optimistic delete (optional)
- [ ] `useToggleActive()` — optimistic update: flip `is_active` locally trước khi server confirm

### TASK-20: Refactor Index.tsx
File: `src/pages/Index.tsx`
- [ ] Xóa `useState` cho `links`, `loading`
- [ ] Xóa `useCallback(refresh)` + `setInterval`
- [ ] Dùng `useLinks()` hook
- [ ] Pass `useCreateLink().mutate` xuống `CreateLinkDialog`
- [ ] Pass mutations xuống `LinkCard`

### TASK-21: Refactor CreateLinkDialog + EditLinkDialog
- [ ] Nhận mutation functions qua props thay vì tự gọi db.ts trực tiếp
- [ ] `isPending` từ mutation → disable submit + show spinner

## Files Created
- `src/lib/query-keys.ts`
- `src/hooks/use-links.ts`
- `src/hooks/use-link-mutations.ts`

## Files Modified
- `src/pages/Index.tsx`
- `src/components/CreateLinkDialog.tsx`
- `src/components/EditLinkDialog.tsx`
- `src/components/LinkCard.tsx`

## Success Criteria
- Không còn manual `setInterval` trong component
- Loading skeleton hiển thị khi fetch lần đầu
- Sau create/edit/delete, danh sách tự cập nhật (không cần F5)
- Toggle active/inactive phản hồi ngay (optimistic update)
