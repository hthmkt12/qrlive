# Code Review — Custom Short Code Feature

**Date:** 2026-03-16
**Score: 7.5 / 10**
**Reviewer:** code-reviewer agent

---

## Scope

| File | LOC | Role |
|------|-----|------|
| `src/lib/schemas.ts` | 33 | Zod schema |
| `src/lib/db.ts` | 142 | DB layer |
| `src/hooks/use-link-mutations.ts` | 106 | React Query mutations |
| `src/components/CreateLinkDialog.tsx` | 195 | UI form |
| `supabase/functions/redirect/index.ts` | 123 | Edge redirect (context) |

---

## Overall Assessment

The feature is functional and well-structured. Client-side validation (Zod), DB normalization, uniqueness check, and UI error surfacing are all present. The primary issues are a **TOCTOU race** in the uniqueness check, a **format mismatch** between the DB layer and the redirect edge function that will silently break custom codes at runtime, and a minor Zod schema ambiguity. No injection or path traversal risk.

---

## Critical Issues

### 1. Format mismatch — custom codes will never resolve (BREAKING)

**File:** `db.ts` line 69 / `redirect/index.ts` line 22

`createLinkInDB` normalizes the user input to uppercase:
```ts
const normalized = customShortCode.trim().toUpperCase();
```

The stored code may therefore be e.g. `MY-LINK` (contains `-`), but the redirect edge function enforces:
```ts
if (!shortCode || !/^[A-Z0-9]{6}$/.test(shortCode)) { ... }  // rejects anything not 6-char pure alphanumeric
```

Any custom code that is not exactly 6 uppercase alphanumeric characters will be stored in the DB but rejected by the redirect function with a 400. The feature is silently broken for all valid custom inputs.

**Fix:** Either update the redirect validator to accept the same character set and length range as the schema (`^[A-Z0-9_-]{3,20}$`), or document that custom codes must be exactly 6 characters and restrict the schema accordingly. The redirect validator should be the authoritative rule; the schema should match it.

---

## High Priority

### 2. TOCTOU race on uniqueness check

**File:** `db.ts` lines 71–76

Check-then-insert is not atomic:
```
check uniqueness  ←─ window here: two concurrent requests pass
insert            ←─ one will get a DB unique constraint violation
```

The DB error thrown on constraint violation will be a Supabase/Postgres error object, not `new Error("SHORT_CODE_TAKEN")`. The UI `catch` only matches the string `"SHORT_CODE_TAKEN"`, so a race-condition collision will surface as the generic `"Lỗi tạo link"` toast instead of the user-friendly message.

**Severity:** Low probability in practice (short window), but the fallback error message is confusing.

**Fix options (choose one):**
- Keep the pre-check but also handle the DB unique constraint error code (`23505`) in the catch block:
  ```ts
  if (error?.code === "23505") throw new Error("SHORT_CODE_TAKEN");
  ```
- Or rely solely on the constraint violation (remove the pre-check, catch `23505`). This eliminates the race entirely and saves one DB round-trip.

### 3. Zod schema allows both `undefined` and `""` but behaves inconsistently

**File:** `schemas.ts` lines 17–21

```ts
customShortCode: z
  .string()
  .regex(/^[A-Za-z0-9_-]{3,20}$/, ...)
  .optional()
  .or(z.literal(""))
```

The `.optional()` makes the field accept `undefined`. The `.or(z.literal(""))` allows `""`. However the order matters: `.optional()` is applied before `.or()`, meaning the inferred type is `string | undefined` with an internal union that accepts `""` only via the second branch. This works in practice, but a subtlety: if the user types 1–2 characters and then clears the field, the regex error fires on intermediate values. The empty-string branch isn't reached until the field is fully empty. This creates transient validation noise while typing.

More importantly: the schema accepts mixed-case input (`[A-Za-z]`) but `db.ts` uppercases it before storing. The code shown to the user in the UI will differ from the stored code with no feedback. A user who enters `my-link` will see `/r/my-link` in the input but their QR redirects to `/r/MY-LINK`.

**Fix:** Either restrict schema regex to `^[A-Z0-9_-]{3,20}$` and add a `transform` to uppercase, or show the normalized value back to the user after submission. The schema-level `transform` approach is cleaner:
```ts
.transform(v => v.toUpperCase())
```

---

## Medium Priority

### 4. Geo route insert errors are silently swallowed

**File:** `db.ts` lines 90–104

```ts
await supabase.from("geo_routes").insert(routes);  // no error check
```

This is pre-existing but adjacent to the new code path. If geo-route insertion fails after the link is successfully created, the link exists in DB without its geo rules, and the user sees a success toast. This is data inconsistency.

**Fix:** Check the error return and throw, or use a Postgres transaction (the `upsert_geo_routes` RPC pattern already used in `updateGeoRoutesInDB` is the right model — apply the same pattern to create).

### 5. Type narrowing gap in mutation hook

**File:** `use-link-mutations.ts` line 31

The `geoRoutes` type in `useCreateLink` is:
```ts
geoRoutes: { country: string; countryCode: string; targetUrl: string }[]
```

But `createLinkInDB` accepts `bypassUrl?: string` on each route. The type at the hook boundary drops `bypassUrl`, so the component correctly passes it (line 55 of the dialog) but it's not reflected in the hook's public type. TypeScript won't complain because extra fields are stripped by the object literal, but it means `bypassUrl` is silently excluded from all creates going through this hook.

**Fix:** Add `bypassUrl?: string` to the route type in `useCreateLink`'s `mutationFn` parameter.

---

## Low Priority

### 6. No rate-limiting on custom code creation

Any authenticated user can enumerate or squat on short codes by creating and immediately deleting links. No throttle is applied client-side or at the DB level. Acceptable for current scale; worth noting for growth.

### 7. Placeholder text doesn't match normalization behavior

**File:** `CreateLinkDialog.tsx` line 114

`placeholder="vi-du-cua-toi"` uses lowercase. Since the value is uppercased on write, the placeholder is misleading about what will actually be stored. Minor UX issue.

---

## Positive Observations

- Zod regex is tight and well-commented (`[A-Za-z0-9_-]{3,20}`). Input length bounds are appropriate.
- `customShortCode || undefined` pattern in the dialog correctly prevents passing `""` to the DB layer.
- `.trim()` before uniqueness check and normalization prevents whitespace-padded duplicates.
- `SHORT_CODE_TAKEN` as a sentinel error string is clean and avoids leaking DB internals to the UI.
- Pre-check query uses `maybeSingle()` rather than `single()`, avoiding an unnecessary 406 on miss.
- Redirect edge function validates format and blocks non-HTTP redirect targets — solid defense in depth (though now misaligned with custom codes, per issue 1).

---

## Recommended Actions (Priority Order)

1. **Fix the redirect validator** to accept `^[A-Z0-9_-]{3,20}$` — otherwise the feature is broken at runtime for any custom code.
2. **Handle DB constraint violation `23505`** as a `SHORT_CODE_TAKEN` error in `createLinkInDB` — closes the TOCTOU gap.
3. **Add `bypassUrl?` to the hook's route type** — silent data loss on create.
4. **Apply schema-level uppercase transform** or update the regex to uppercase-only and add user feedback showing the normalized value.
5. **Check geo_routes insert error** or refactor to use the existing `upsert_geo_routes` RPC pattern.

---

## Metrics

| Metric | Value |
|--------|-------|
| Type coverage | ~90% — one gap at hook boundary (issue 5) |
| Test coverage | Not assessed (no test files in scope) |
| Linting issues | None observed |
| Security issues | None (no injection, no path traversal) |

---

## Unresolved Questions

- Is there a DB unique constraint on `qr_links.short_code`? If not, the TOCTOU race has no safety net at all. Recommend verifying the migration.
- Will the redirect function be updated in the same PR? If not, issue 1 is a silent regression that goes live immediately.
