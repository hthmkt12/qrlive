/**
 * redirect-handler.ts — runtime-agnostic redirect logic
 *
 * Extracted from index.ts so the same handler can run under
 * Deno.serve (production) or Vitest (tests) via an adapter.
 */

// ── Adapter interface ────────────────────────────────────────────────────────

/** Minimal subset of Supabase client used by the handler */
export interface SupabaseAdapter {
  /** Fetch an active link by short code (returns null when not found) */
  fetchLink(shortCode: string): Promise<LinkRecord | null>;
  /** Check recent click count for rate-limiting */
  recentClickCount(linkId: string, ip: string, sinceISO: string): Promise<number>;
  /** Insert a click event */
  insertClick(event: ClickEvent): Promise<void>;
  /** Update link row (used for opportunistic password rehash) */
  updateLink(id: string, fields: Record<string, unknown>): Promise<void>;
}

export interface LinkRecord {
  id: string;
  default_url: string;
  expires_at?: string | null;
  password_hash?: string | null;
  password_salt?: string | null;
  geo_routes: GeoRoute[];
}

export interface GeoRoute {
  country_code: string;
  target_url: string;
  bypass_url?: string;
}

export interface ClickEvent {
  link_id: string;
  country: string;
  country_code: string;
  ip_address: string;
  user_agent: string;
  referer: string;
}

/** Simplified request representation (works in both Deno and Node) */
export interface HandlerRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  /** For POST — already-parsed form data */
  formData?: Record<string, string>;
}

/** Simplified response representation */
export interface HandlerResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BOT_PATTERN = /bot|crawler|spider|prerender|headless|facebookexternalhit|twitterbot|slurp/i;

// ── Password utilities ───────────────────────────────────────────────────────

const PBKDF2_ITERATIONS = 600_000;
const HASH_BYTES = 32;

function bufToBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function base64ToBuf(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function hashPasswordPBKDF2(password: string): Promise<string> {
  const saltArr = new Uint8Array(16);
  crypto.getRandomValues(saltArr);
  const saltBuf = saltArr.buffer as ArrayBuffer;
  const keyMaterial = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"],
  );
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBuf, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial, HASH_BYTES * 8,
  );
  return `pbkdf2:sha256:${PBKDF2_ITERATIONS}:${bufToBase64(saltBuf)}:${bufToBase64(derived)}`;
}

export async function verifyPassword(
  password: string,
  storedHash: string,
  legacySalt?: string | null,
): Promise<boolean> {
  if (storedHash.startsWith("pbkdf2:")) return verifyPBKDF2(password, storedHash);
  if (!legacySalt) return false;
  return verifyLegacySHA256(password, legacySalt, storedHash);
}

async function verifyPBKDF2(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split(":");
  if (parts.length !== 5) return false;
  const iterations = parseInt(parts[2], 10);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;
  const salt = base64ToBuf(parts[3]);
  const expected = base64ToBuf(parts[4]);
  const keyMaterial = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"],
  );
  const derived = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: salt.buffer as ArrayBuffer, iterations, hash: "SHA-256" },
      keyMaterial, expected.length * 8,
    ),
  );
  return constantTimeEqual(derived, expected);
}

async function verifyLegacySHA256(password: string, salt: string, storedHex: string): Promise<boolean> {
  const data = new TextEncoder().encode(salt + password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const computed = new Uint8Array(hashBuffer);
  return constantTimeEqual(computed, hexToBytes(storedHex));
}

export function isLegacyHash(storedHash: string): boolean {
  return !storedHash.startsWith("pbkdf2:");
}

// ── Password form ────────────────────────────────────────────────────────────

export function buildPasswordForm(shortCode: string, errorMsg?: string): string {
  const error = errorMsg ? `<p class="error">${errorMsg}</p>` : "";
  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Link được bảo vệ</title>
<style>
  body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0f0f13;color:#e2e8f0}
  .card{background:#1a1a2e;border:1px solid #2d2d44;border-radius:12px;padding:32px;width:100%;max-width:360px}
  h1{font-size:1.2rem;margin:0 0 8px}
  p{font-size:.875rem;color:#94a3b8;margin:0 0 20px}
  .error{color:#f87171;margin-bottom:16px}
  input{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:8px;border:1px solid #2d2d44;background:#0f0f13;color:#e2e8f0;font-size:1rem;margin-bottom:16px}
  button{width:100%;padding:10px;border-radius:8px;border:none;background:linear-gradient(135deg,#2dd4bf,#3b82f6);color:#fff;font-weight:600;font-size:1rem;cursor:pointer}
</style>
</head>
<body>
<div class="card">
  <h1>Link được bảo vệ</h1>
  <p>Vui lòng nhập mật khẩu để tiếp tục.</p>
  ${error}
  <form method="POST" action="">
    <input type="password" name="password" placeholder="Mật khẩu" autofocus required />
    <button type="submit">Tiếp tục</button>
  </form>
</div>
</body>
</html>`;
}

// ── Geo-routing ──────────────────────────────────────────────────────────────

export function resolveTarget(
  defaultUrl: string,
  countryCode: string,
  geoRoutes: GeoRoute[],
): string {
  if (countryCode && geoRoutes?.length > 0) {
    const route = geoRoutes.find((r) => r.country_code.toUpperCase() === countryCode);
    if (route) return route.bypass_url || route.target_url;
  }
  return defaultUrl;
}

// ── Click recording ──────────────────────────────────────────────────────────

async function recordClick(
  adapter: SupabaseAdapter,
  linkId: string,
  ip: string,
  countryCode: string,
  userAgent: string,
  referer: string,
): Promise<void> {
  if (BOT_PATTERN.test(userAgent)) return;

  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  const count = await adapter.recentClickCount(linkId, ip, oneMinuteAgo);
  if (count === 0) {
    await adapter.insertClick({
      link_id: linkId,
      country: countryCode,
      country_code: countryCode,
      ip_address: ip,
      user_agent: userAgent,
      referer,
    });
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function handleRedirect(
  req: HandlerRequest,
  adapter: SupabaseAdapter,
): Promise<HandlerResponse> {
  if (req.method === "OPTIONS") {
    return { status: 200, headers: { ...CORS_HEADERS }, body: "" };
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const shortCode = pathParts[pathParts.length - 1];

    if (!shortCode || !/^[A-Z0-9_-]{3,20}$/.test(shortCode)) {
      return {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Invalid short code" }),
      };
    }

    const link = await adapter.fetchLink(shortCode);
    if (!link) {
      return {
        status: 404,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Link not found or inactive" }),
      };
    }

    // Expiration check
    if (link.expires_at && new Date(link.expires_at) <= new Date()) {
      return {
        status: 410,
        headers: { ...CORS_HEADERS, "Content-Type": "text/html; charset=utf-8" },
        body:
          `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Link đã hết hạn</title></head>` +
          `<body><h1>Link này đã hết hạn</h1><p>Link bạn truy cập đã hết hạn và không còn hoạt động.</p></body></html>`,
      };
    }

    // Password protection
    if (link.password_hash) {
      if (req.method === "POST") {
        const submittedPassword = req.formData?.password ?? "";
        const isValid =
          submittedPassword !== "" &&
          (await verifyPassword(submittedPassword, link.password_hash, link.password_salt));

        if (!isValid) {
          return {
            status: 401,
            headers: { ...CORS_HEADERS, "Content-Type": "text/html; charset=utf-8" },
            body: buildPasswordForm(shortCode, "Mật khẩu không đúng. Vui lòng thử lại."),
          };
        }

        // Opportunistic rehash
        if (isLegacyHash(link.password_hash)) {
          try {
            const newHash = await hashPasswordPBKDF2(submittedPassword);
            await adapter.updateLink(link.id, { password_hash: newHash, password_salt: null });
          } catch {
            // best-effort
          }
        }
      } else {
        return {
          status: 200,
          headers: { ...CORS_HEADERS, "Content-Type": "text/html; charset=utf-8" },
          body: buildPasswordForm(shortCode),
        };
      }
    }

    // Analytics & redirect
    const userAgent = req.headers["user-agent"] || "";
    const referer = (req.headers["referer"] || "direct").substring(0, 500);
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.headers["cf-connecting-ip"] ||
      "unknown";
    const countryCode = (req.headers["cf-ipcountry"] || "").toUpperCase();

    await recordClick(adapter, link.id, ip, countryCode, userAgent, referer);

    const targetUrl = resolveTarget(link.default_url, countryCode, link.geo_routes ?? []);

    if (!/^https?:\/\//i.test(targetUrl)) {
      return {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Invalid redirect target" }),
      };
    }

    return {
      status: 302,
      headers: {
        ...CORS_HEADERS,
        Location: targetUrl,
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex",
      },
      body: "",
    };
  } catch (error) {
    console.error("Redirect error:", error);
    return {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
}
