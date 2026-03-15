# Phase 1: Schema Validation

**File:** `src/lib/schemas.ts`

## Change

Add optional `customShortCode` field to `linkFormSchema`:

```ts
export const linkFormSchema = z.object({
  name: z.string().min(1, "Tên không được để trống").max(100, "Tên quá dài"),
  defaultUrl: z.string().url("URL mặc định không hợp lệ"),
  geoRoutes: z.array(geoRouteSchema).default([]),
  customShortCode: z
    .string()
    .regex(/^[A-Za-z0-9_-]{3,20}$/, "Short code chỉ chứa chữ, số, - hoặc _, 3–20 ký tự")
    .optional()
    .or(z.literal("")),  // allow empty string (means auto-generate)
});
```

Also update `LinkFormInput` type (inferred automatically from schema).

## Validation rules
- Empty string / undefined → auto-generate (pass-through, no error)
- Non-empty → must match `/^[A-Za-z0-9_-]{3,20}$/`
- Uniqueness is NOT validated in schema (checked in DB layer on submit)
