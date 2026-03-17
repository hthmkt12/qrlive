# Phase 03 — Security Fixes
**Priority:** P1 | **Status:** Todo

## Fix 1: Replace Math.random() with crypto.getRandomValues()
**File:** `src/lib/db.ts:144`
**Issue:** `Math.random()` is not cryptographically secure — short codes could be enumerated.

**Current:**
```ts
const code = Math.random().toString(36).substring(2, 8).toUpperCase();
```

**Fix:**
```ts
const bytes = new Uint8Array(4);
crypto.getRandomValues(bytes);
const code = Array.from(bytes)
  .map(b => b.toString(36))
  .join('')
  .substring(0, 6)
  .toUpperCase();
```

Or simpler with `crypto.randomUUID()` trimmed:
```ts
const code = crypto.randomUUID().replace(/-/g, '').substring(0, 6).toUpperCase();
```

## Fix 2: Normalize Auth Error Messages (Prevent User Enumeration)
**File:** `src/pages/Auth.tsx:34`
**Issue:** Raw Supabase error message shown to user → reveals whether email exists.

**Current:**
```ts
setServerError(e instanceof Error ? e.message : "Đã có lỗi xảy ra");
```

**Fix:**
```ts
// Don't expose specific auth errors — prevent user enumeration
setServerError("Email hoặc mật khẩu không đúng. Vui lòng thử lại.");
```

Note: For signup flow, keep specific errors like "Email đã được đăng ký" only if that's acceptable UX.

## Fix 3: Specific Error Handling in EditLinkDialog
**File:** `src/components/EditLinkDialog.tsx:63-81`
**Issue:** Generic catch block gives no info on SHORT_CODE_TAKEN errors.

**Current:**
```ts
catch {
  toast({ title: "Lỗi cập nhật", variant: "destructive" });
}
```

**Fix:** Mirror CreateLinkDialog pattern:
```ts
catch (e) {
  const msg = e instanceof Error ? e.message : "";
  if (msg === "SHORT_CODE_TAKEN") {
    form.setError("short_code", { message: "Mã ngắn đã được sử dụng" });
  } else {
    toast({ title: "Lỗi cập nhật", description: "Vui lòng thử lại", variant: "destructive" });
  }
}
```

## Todo
- [x] Read `src/lib/db.ts` around line 144 to verify current code
- [x] Fix short code generation to use `crypto.randomUUID()`
- [x] Read `src/pages/Auth.tsx` to understand signin/signup error flows
- [x] Normalize auth error messages (distinguish signin vs signup where needed)
- [x] Read `src/components/EditLinkDialog.tsx:63-81`
- [x] Add SHORT_CODE_TAKEN error handling
- [x] Run `npm run test -- --run` to confirm no regressions

## Success Criteria
- Short code generation uses crypto API
- Auth errors don't expose "user not found" vs "wrong password"
- EditLinkDialog shows specific SHORT_CODE_TAKEN feedback
- All tests still pass
