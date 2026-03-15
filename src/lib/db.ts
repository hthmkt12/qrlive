import { supabase } from "@/integrations/supabase/client";

export interface QRLinkRow {
  id: string;
  name: string;
  short_code: string;
  default_url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  geo_routes: GeoRouteRow[];
}

export interface GeoRouteRow {
  id: string;
  link_id: string;
  country: string;
  country_code: string;
  target_url: string;
  bypass_url?: string | null;
}

export interface ClickEventRow {
  id: string;
  link_id: string;
  country_code: string | null;
  referer: string | null;
  created_at: string;
}

export async function fetchLinks(): Promise<QRLinkRow[]> {
  const { data, error } = await supabase
    .from("qr_links")
    .select("*, geo_routes(*)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as QRLinkRow[]) || [];
}

export interface LinkAnalyticsSummaryRow {
  link_id: string;
  total_clicks: number;
  today_clicks: number;
  top_country_code: string | null;
}

export interface LinkAnalyticsDayRow {
  date: string;
  clicks: number;
}

export interface LinkAnalyticsCountryRow {
  country_code: string;
  clicks: number;
}

export interface LinkAnalyticsRefererRow {
  referer: string;
  clicks: number;
}

export interface LinkAnalyticsDetailRow {
  link_id: string;
  total_clicks: number;
  today_clicks: number;
  countries_count: number;
  clicks_by_day: LinkAnalyticsDayRow[];
  country_breakdown: LinkAnalyticsCountryRow[];
  referer_breakdown: LinkAnalyticsRefererRow[];
}

export async function fetchLinkAnalyticsSummaries(
  linkIds: string[]
): Promise<LinkAnalyticsSummaryRow[]> {
  if (linkIds.length === 0) return [];

  const { data, error } = await supabase.rpc("get_link_click_summaries", {
    p_link_ids: linkIds,
  });

  if (error) throw error;

  return ((data as LinkAnalyticsSummaryRow[] | null) || []).map((row) => ({
    ...row,
    total_clicks: Number(row.total_clicks || 0),
    today_clicks: Number(row.today_clicks || 0),
  }));
}

function normalizeAnalyticsRows<T extends Record<string, unknown>>(
  value: unknown,
  mapper: (row: Record<string, unknown>) => T
): T[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row): row is Record<string, unknown> => !!row && typeof row === "object")
    .map(mapper);
}

export async function fetchLinkAnalyticsDetail(linkId: string): Promise<LinkAnalyticsDetailRow> {
  const { data, error } = await supabase.rpc("get_link_click_detail", {
    p_link_id: linkId,
  });

  if (error) throw error;

  const row = ((data as LinkAnalyticsDetailRow[] | null) || [])[0];
  if (!row) {
    return {
      link_id: linkId,
      total_clicks: 0,
      today_clicks: 0,
      countries_count: 0,
      clicks_by_day: [],
      country_breakdown: [],
      referer_breakdown: [],
    };
  }

  return {
    link_id: row.link_id,
    total_clicks: Number(row.total_clicks || 0),
    today_clicks: Number(row.today_clicks || 0),
    countries_count: Number(row.countries_count || 0),
    clicks_by_day: normalizeAnalyticsRows(row.clicks_by_day, (entry) => ({
      date: String(entry.date || ""),
      clicks: Number(entry.clicks || 0),
    })),
    country_breakdown: normalizeAnalyticsRows(row.country_breakdown, (entry) => ({
      country_code: String(entry.country_code || ""),
      clicks: Number(entry.clicks || 0),
    })),
    referer_breakdown: normalizeAnalyticsRows(row.referer_breakdown, (entry) => ({
      referer: String(entry.referer || "direct"),
      clicks: Number(entry.clicks || 0),
    })),
  };
}

/** Generate a 6-char alphanumeric short code, retrying up to 5 times on collision */
async function generateShortCode(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { data } = await supabase
      .from("qr_links")
      .select("id")
      .eq("short_code", code)
      .maybeSingle();
    if (!data) return code; // no collision
  }
  throw new Error("Failed to generate unique short code after 5 attempts");
}

export async function createLinkInDB(
  name: string,
  defaultUrl: string,
  geoRoutes: { country: string; countryCode: string; targetUrl: string; bypassUrl?: string }[],
  userId: string,
  customShortCode?: string
): Promise<QRLinkRow> {
  let shortCode: string;

  if (customShortCode && customShortCode.trim() !== "") {
    const normalized = customShortCode.trim().toUpperCase();
    // Validate format matches redirect validator: 3–20 uppercase alphanumeric, hyphens, underscores
    if (!/^[A-Z0-9_-]{3,20}$/.test(normalized)) {
      throw new Error("INVALID_SHORT_CODE_FORMAT");
    }
    // Check uniqueness before using custom code
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

  const { data: link, error } = await supabase
    .from("qr_links")
    .insert({ name, short_code: shortCode, default_url: defaultUrl, user_id: userId })
    .select()
    .single();

  // Postgres unique constraint violation (23505) means short code race — surface friendly error
  if (error) {
    if ((error as { code?: string }).code === "23505") throw new Error("SHORT_CODE_TAKEN");
    throw error;
  }
  if (!link) throw new Error("Failed to create link");

  if (geoRoutes.length > 0) {
    const routes = geoRoutes
      .filter((r) => r.countryCode && r.targetUrl)
      .map((r) => ({
        link_id: link.id,
        country: r.country,
        country_code: r.countryCode,
        target_url: r.targetUrl,
        bypass_url: r.bypassUrl || null,
      }));

    if (routes.length > 0) {
      const { error: routesError } = await supabase.from("geo_routes").insert(routes);
      if (routesError) throw routesError;
    }
  }

  return { ...link, geo_routes: [] } as QRLinkRow;
}

export async function updateLinkInDB(
  id: string,
  updates: { name?: string; default_url?: string; is_active?: boolean }
) {
  const { error } = await supabase.from("qr_links").update(updates).eq("id", id);
  if (error) throw error;
}

export async function updateGeoRoutesInDB(
  linkId: string,
  geoRoutes: { country: string; countryCode: string; targetUrl: string; bypassUrl?: string }[]
) {
  // Atomic delete + insert via Postgres function — prevents partial state on insert failure
  const { error } = await supabase.rpc("upsert_geo_routes", {
    p_link_id: linkId,
    p_routes: geoRoutes.map((r) => ({
      country: r.country,
      country_code: r.countryCode,
      target_url: r.targetUrl,
      bypass_url: r.bypassUrl || "",
    })),
  });
  if (error) throw error;
}

export async function deleteLinkInDB(id: string) {
  const { error } = await supabase.from("qr_links").delete().eq("id", id);
  if (error) throw error;
}

export function getRedirectUrl(shortCode: string): string {
  // VITE_REDIRECT_BASE_URL allows custom domain (e.g. China-accessible proxy).
  // Falls back to Supabase Edge Function URL when not configured.
  const base =
    import.meta.env.VITE_REDIRECT_BASE_URL ||
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/redirect`;
  return `${base}/${shortCode}`;
}
