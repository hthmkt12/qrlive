import { buildClickWebhookPayload, dispatchClickWebhook, reportClickWebhookError } from "./click-webhook.ts";
import { buildPasswordForm, hashPasswordPBKDF2, isLegacyHash, verifyPassword } from "./redirect-password.ts";

export { buildPasswordForm, hashPasswordPBKDF2, isLegacyHash, verifyPassword };

export interface SupabaseAdapter {
  fetchLink(shortCode: string): Promise<LinkRecord | null>;
  recentClickCount(linkId: string, ip: string, sinceISO: string): Promise<number>;
  insertClick(event: ClickEvent): Promise<void>;
  updateLink(id: string, fields: Record<string, unknown>): Promise<void>;
}

export interface LinkRecord {
  id: string;
  name: string;
  short_code: string;
  default_url: string;
  webhook_url?: string | null;
  expires_at?: string | null;
  password_hash?: string | null;
  password_salt?: string | null;
  geo_routes: GeoRoute[];
}

export interface GeoRoute { country_code: string; target_url: string; bypass_url?: string; }
export interface ClickEvent {
  link_id: string;
  country: string;
  country_code: string;
  ip_address: string;
  user_agent: string;
  referer: string;
}
export interface HandlerRequest { method: string; url: string; headers: Record<string, string>; formData?: Record<string, string>; }
export interface HandlerResponse { status: number; headers: Record<string, string>; body: string; }
export interface RedirectRuntimeOptions { fetchImpl?: typeof fetch; queueBackgroundTask?: (task: Promise<void>) => void; }

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BOT_PATTERN = /bot|crawler|spider|prerender|headless|facebookexternalhit|twitterbot|slurp/i;
const SHORT_CODE_PATTERN = /^[A-Z0-9_-]{3,20}$/;
const HTML_HEADERS = { ...CORS_HEADERS, "Content-Type": "text/html; charset=utf-8" };
const JSON_HEADERS = { ...CORS_HEADERS, "Content-Type": "application/json" };
const EXPIRED_HTML =
  "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Link đã hết hạn</title></head>" +
  "<body><h1>Link này đã hết hạn</h1><p>Link bạn truy cập đã hết hạn và không còn hoạt động.</p></body></html>";

export function resolveTarget(defaultUrl: string, countryCode: string, geoRoutes: GeoRoute[]): string {
  if (!countryCode || geoRoutes.length === 0) return defaultUrl;
  const route = geoRoutes.find((entry) => entry.country_code.toUpperCase() === countryCode);
  return route ? route.bypass_url || route.target_url : defaultUrl;
}

async function recordClick(adapter: SupabaseAdapter, linkId: string, ip: string, countryCode: string, userAgent: string, referer: string) {
  if (BOT_PATTERN.test(userAgent)) return false;
  const recentCount = await adapter.recentClickCount(linkId, ip, new Date(Date.now() - 60_000).toISOString());
  if (recentCount > 0) return false;
  await adapter.insertClick({ link_id: linkId, country: countryCode, country_code: countryCode, ip_address: ip, user_agent: userAgent, referer });
  return true;
}

function queueWebhook(link: LinkRecord, countryCode: string, referer: string, redirectUrl: string, options: RedirectRuntimeOptions) {
  if (!link.webhook_url) return;
  const task = dispatchClickWebhook(
    link.webhook_url,
    buildClickWebhookPayload({
      countryCode,
      defaultUrl: link.default_url,
      linkId: link.id,
      linkName: link.name,
      occurredAt: new Date().toISOString(),
      redirectUrl,
      referer,
      shortCode: link.short_code,
    }),
    options.fetchImpl
  ).catch((error) => reportClickWebhookError(link.webhook_url!, error));

  if (options.queueBackgroundTask) {
    options.queueBackgroundTask(task);
    return;
  }
  void task;
}

function getRequestContext(headers: Record<string, string>) {
  return {
    userAgent: headers["user-agent"] || "",
    referer: (headers.referer || "direct").substring(0, 500),
    ip: headers["x-forwarded-for"]?.split(",")[0]?.trim() || headers["cf-connecting-ip"] || "unknown",
    countryCode: (headers["cf-ipcountry"] || "").toUpperCase(),
  };
}

export async function handleRedirect(req: HandlerRequest, adapter: SupabaseAdapter, options: RedirectRuntimeOptions = {}): Promise<HandlerResponse> {
  if (req.method === "OPTIONS") return { status: 200, headers: { ...CORS_HEADERS }, body: "" };

  try {
    const shortCode = new URL(req.url).pathname.split("/").pop() || "";
    if (!shortCode || !SHORT_CODE_PATTERN.test(shortCode)) {
      return { status: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: "Invalid short code" }) };
    }

    const link = await adapter.fetchLink(shortCode);
    if (!link) return { status: 404, headers: JSON_HEADERS, body: JSON.stringify({ error: "Link not found or inactive" }) };
    if (link.expires_at && new Date(link.expires_at) <= new Date()) return { status: 410, headers: HTML_HEADERS, body: EXPIRED_HTML };

    if (link.password_hash) {
      if (req.method !== "POST") return { status: 200, headers: HTML_HEADERS, body: buildPasswordForm(shortCode) };
      const submittedPassword = req.formData?.password ?? "";
      const isValid = submittedPassword !== "" && await verifyPassword(submittedPassword, link.password_hash, link.password_salt);
      if (!isValid) return { status: 401, headers: HTML_HEADERS, body: buildPasswordForm(shortCode, "Mật khẩu không đúng. Vui lòng thử lại.") };

      if (isLegacyHash(link.password_hash)) {
        try {
          const newHash = await hashPasswordPBKDF2(submittedPassword);
          await adapter.updateLink(link.id, { password_hash: newHash, password_salt: null });
        } catch {
          // Best-effort rehash only.
        }
      }
    }

    const { countryCode, ip, referer, userAgent } = getRequestContext(req.headers);
    const targetUrl = resolveTarget(link.default_url, countryCode, link.geo_routes ?? []);
    if (!/^https?:\/\//i.test(targetUrl)) {
      return { status: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: "Invalid redirect target" }) };
    }

    if (await recordClick(adapter, link.id, ip, countryCode, userAgent, referer)) {
      queueWebhook(link, countryCode, referer, targetUrl, options);
    }

    return {
      status: 302,
      headers: { ...CORS_HEADERS, Location: targetUrl, "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
      body: "",
    };
  } catch (error) {
    console.error("Redirect error:", error);
    return { status: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: "Internal server error" }) };
  }
}
