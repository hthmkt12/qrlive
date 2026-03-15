# Phase 1: Env Var + getRedirectUrl

**Files:** `src/lib/db.ts`, `.env.example`

## Change: db.ts

```ts
export function getRedirectUrl(shortCode: string): string {
  // VITE_REDIRECT_BASE_URL allows custom domain for China/firewall bypass
  // Falls back to Supabase Edge Function URL if not configured
  const base =
    import.meta.env.VITE_REDIRECT_BASE_URL ||
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/redirect`;
  return `${base}/${shortCode}`;
}
```

## Change: .env.example

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key-here

# Optional: custom redirect domain (for China accessibility)
# Leave empty to use Supabase Edge Function URL (default)
# Example: https://r.yourdomain.com
VITE_REDIRECT_BASE_URL=
```

## Backward compatibility
- If `VITE_REDIRECT_BASE_URL` is not set → same behavior as today
- Existing QR codes remain valid (Supabase URL unchanged)
- New deployments can opt-in to custom domain
