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
  click_events: ClickEventRow[];
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
  country: string | null;
  country_code: string | null;
  ip_address: string | null;
  user_agent: string | null;
  referer: string | null;
  created_at: string;
}

export async function fetchLinks(): Promise<QRLinkRow[]> {
  const { data, error } = await supabase
    .from("qr_links")
    .select("*, geo_routes(*), click_events(*)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as QRLinkRow[]) || [];
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
      await supabase.from("geo_routes").insert(routes);
    }
  }

  return { ...link, geo_routes: [], click_events: [] } as QRLinkRow;
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
  return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/redirect/${shortCode}`;
}
