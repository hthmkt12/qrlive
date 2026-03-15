# Phase 2: DB Function

**File:** `src/lib/db.ts`

## Change

Modify `createLinkInDB` signature to accept optional `customShortCode`:

```ts
export async function createLinkInDB(
  name: string,
  defaultUrl: string,
  geoRoutes: { country: string; countryCode: string; targetUrl: string; bypassUrl?: string }[],
  userId: string,
  customShortCode?: string   // ← new optional param
): Promise<QRLinkRow> {
  let shortCode: string;

  if (customShortCode && customShortCode.trim() !== "") {
    const normalized = customShortCode.trim().toUpperCase();
    // Check uniqueness
    const { data: existing } = await supabase
      .from("qr_links")
      .select("id")
      .eq("short_code", normalized)
      .maybeSingle();
    if (existing) throw new Error("SHORT_CODE_TAKEN");
    shortCode = normalized;
  } else {
    shortCode = await generateShortCode();
  }

  // ... rest unchanged
}
```

## Error contract
- Throws `Error("SHORT_CODE_TAKEN")` when custom code is already used
- UI catches this specific message to show localized error

## Notes
- `generateShortCode()` stays unchanged (used as fallback)
- No DB migration needed
