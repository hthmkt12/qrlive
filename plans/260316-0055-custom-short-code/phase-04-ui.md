# Phase 4: UI Form Field

**File:** `src/components/CreateLinkDialog.tsx`

## Change

1. Add `customShortCode` field to `defaultValues` (empty string = auto-generate)
2. Add UI input below "URL mặc định"
3. Pass `customShortCode` to `createLink.mutateAsync()`
4. Handle `SHORT_CODE_TAKEN` error specifically

### defaultValues

```ts
defaultValues: { name: "", defaultUrl: "", geoRoutes: [], customShortCode: "" },
```

### UI (add after defaultUrl block):

```tsx
{/* Custom short code — optional */}
<div className="space-y-1">
  <Label className="flex items-center gap-2">
    Short code
    <span className="text-xs text-muted-foreground font-normal">(tuỳ chọn — để trống để tự tạo)</span>
  </Label>
  <div className="flex items-center gap-2">
    <span className="text-xs text-muted-foreground shrink-0 font-mono">/r/</span>
    <Input
      placeholder="vi-du-cua-toi"
      {...register("customShortCode")}
      className="font-mono uppercase"
    />
  </div>
  {errors.customShortCode && (
    <p className="text-xs text-destructive">{errors.customShortCode.message}</p>
  )}
</div>
```

> Note: `className="uppercase"` is visual only (CSS). Normalization to uppercase happens in `db.ts`.

### onSubmit change:

```ts
await createLink.mutateAsync({
  name: data.name,
  defaultUrl: data.defaultUrl,
  geoRoutes: ...,
  userId: user.id,
  customShortCode: data.customShortCode || undefined,
});
```

### Error handling:

```ts
} catch (err) {
  const msg = err instanceof Error && err.message === "SHORT_CODE_TAKEN"
    ? "Short code này đã được dùng, vui lòng chọn cái khác"
    : "Lỗi tạo link";
  toast({ title: msg, variant: "destructive" });
}
```

## Notes
- `watch` is already imported and available
- The `/r/` prefix is visual only (display), actual URL uses the raw short code
- CSS `uppercase` on input is UX improvement but optional
