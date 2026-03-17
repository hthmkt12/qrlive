// Write operations: create, update, delete links and geo routes in Supabase

import { supabase } from "@/integrations/supabase/client";
import { hashPassword } from "@/lib/password-utils";
import { purgeLinkMetadataCacheQuietly } from "@/lib/link-cache-invalidation";
import type { QRLinkRow, QrConfig } from "./models";

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
  customShortCode?: string,
  expiresAt?: string | null,
  password?: string,
  qrConfig?: QrConfig | null,
  webhookUrl?: string | null,
  webhookSecret?: string | null
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

  // Hash password if provided (PBKDF2 — salt is embedded in the hash string)
  let passwordHash: string | null = null;
  if (password && password.trim() !== "") {
    passwordHash = await hashPassword(password);
  }

  const insertPayload = {
    name,
    short_code: shortCode,
    default_url: defaultUrl,
    user_id: userId,
    expires_at: expiresAt || null,
    password_hash: passwordHash,
    password_salt: null,
    qr_config: qrConfig ?? null,
    webhook_url: webhookUrl ?? null,
  };

  if (webhookSecret && webhookSecret.trim() !== "") {
    Object.assign(insertPayload, { webhook_secret: webhookSecret });
  }

  const { data: link, error } = await supabase
    .from("qr_links")
    .insert(insertPayload)
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
  updates: {
    name?: string;
    default_url?: string;
    webhook_url?: string | null;
    is_active?: boolean;
    expires_at?: string | null;
    qr_config?: QrConfig | null;
  },
  password?: string, // undefined = no change; "" = clear password; non-empty = set new password
  webhookSecret?: string // undefined = no change; "" = clear secret; non-empty = set new secret
) {
  // Build password fields based on the password param
  let passwordFields: { password_hash: string | null; password_salt: string | null } | undefined;
  if (password === "") {
    // Explicit clear: remove password protection
    passwordFields = { password_hash: null, password_salt: null };
  } else if (password && password.trim() !== "") {
    // New password provided: PBKDF2 hash (salt embedded in hash string)
    const hash = await hashPassword(password);
    passwordFields = { password_hash: hash, password_salt: null };
  }

  // Build webhook secret field based on the webhookSecret param
  let secretField: { webhook_secret: string | null } | undefined;
  if (webhookSecret === "") {
    secretField = { webhook_secret: null };
  } else if (webhookSecret && webhookSecret.trim() !== "") {
    secretField = { webhook_secret: webhookSecret };
  }

  const payload = { ...updates, ...passwordFields, ...secretField };
  const { data, error } = await supabase
    .from("qr_links")
    .update(payload)
    .eq("id", id)
    .select("short_code")
    .single();
  if (error) throw error;
  await purgeLinkMetadataCacheQuietly(data?.short_code);
}

export async function updateGeoRoutesInDB(
  linkId: string,
  geoRoutes: { country: string; countryCode: string; targetUrl: string; bypassUrl?: string }[]
) {
  const { data: link } = await supabase
    .from("qr_links")
    .select("short_code")
    .eq("id", linkId)
    .maybeSingle();

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
  await purgeLinkMetadataCacheQuietly(link?.short_code);
}

export async function deleteLinkInDB(id: string) {
  const { data: link } = await supabase
    .from("qr_links")
    .select("short_code")
    .eq("id", id)
    .maybeSingle();

  await purgeLinkMetadataCacheQuietly(link?.short_code);

  const { error } = await supabase
    .from("qr_links")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
