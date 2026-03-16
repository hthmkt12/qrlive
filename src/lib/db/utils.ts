// Utility helpers: URL construction and analytics row normalization

/** Normalize an unknown array of objects using a mapper, filtering invalid entries */
export function normalizeAnalyticsRows<T extends Record<string, unknown>>(
  value: unknown,
  mapper: (row: Record<string, unknown>) => T
): T[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row): row is Record<string, unknown> => !!row && typeof row === "object")
    .map(mapper);
}

/** Build the redirect URL for a short code.
 *  VITE_REDIRECT_BASE_URL allows custom domain (e.g. China-accessible proxy).
 *  Falls back to Supabase Edge Function URL when not configured. */
export function getRedirectUrl(shortCode: string): string {
  const base =
    import.meta.env.VITE_REDIRECT_BASE_URL ||
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/redirect`;
  return `${base}/${shortCode}`;
}
