// Write operations: create, update, delete links and geo routes in Supabase

import { supabase } from "@/integrations/supabase/client";
import type { QRLinkRow } from "./models";

/** Generate a 6-char alphanumeric short code, retrying up to 5 times on collision */
export async function generateShortCode(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    // Use crypto.randomUUID() for cryptographically secure random codes
    const code = crypto.randomUUID().replace(/-/g, "").substring(0, 6).toUpperCase();
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
    // Validate format: 3–20 uppercase alphanumeric, hyphens, underscores
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
