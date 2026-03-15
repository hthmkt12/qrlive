# Phase 3: Mutation Hook

**File:** `src/hooks/use-link-mutations.ts`

## Change

Update `useCreateLink` mutation params to include optional `customShortCode`:

```ts
export function useCreateLink() {
  const invalidate = useInvalidateLinks();
  return useMutation({
    mutationFn: ({
      name,
      defaultUrl,
      geoRoutes,
      userId,
      customShortCode,  // ← add
    }: {
      name: string;
      defaultUrl: string;
      geoRoutes: { country: string; countryCode: string; targetUrl: string }[];
      userId: string;
      customShortCode?: string;  // ← add
    }) => createLinkInDB(name, defaultUrl, geoRoutes, userId, customShortCode),
    onSuccess: invalidate,
  });
}
```

Minimal change — just thread the new param through.
