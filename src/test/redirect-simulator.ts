import { verifyPassword } from "@/lib/password-utils";

/**
 * Redirect edge function simulator
 * Mirrors: supabase/functions/redirect/index.ts behavior
 * Used for testing without calling the real deployed function
 */

/** Mock Supabase link record */
export interface MockLink {
  id: string;
  short_code: string;
  default_url: string;
  expires_at?: string | null;
  password_hash?: string | null;
  password_salt?: string | null;
  is_active: boolean;
  geo_routes?: Array<{
    country_code: string;
    target_url: string;
    bypass_url?: string;
  }>;
}

/** Simulate redirect function response */
export interface RedirectResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

/** Normalize headers to lowercase for consistent test assertions */
function normalizeHeaders(h: Record<string, string>): Record<string, string> {
  const normalized: Record<string, string> = {};
  Object.entries(h).forEach(([key, value]) => {
    normalized[key.toLowerCase()] = value;
  });
  return normalized;
}

/** Build Vietnamese password form HTML */
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

/** Resolve redirect target: bypass_url → target_url → default_url */
export function resolveTarget(
  defaultUrl: string,
  countryCode: string,
  geoRoutes: Array<{ country_code: string; target_url: string; bypass_url?: string }>
): string {
  if (countryCode && geoRoutes.length > 0) {
    const route = geoRoutes.find((r) => r.country_code.toUpperCase() === countryCode);
    if (route) return route.bypass_url || route.target_url;
  }
  return defaultUrl;
}

/**
 * Simulates redirect edge function behavior
 * Tests all flows: normal redirect, password protection, geo-routing, expiry check
 *
 * Uses the shared verifyPassword() which supports both PBKDF2 and legacy SHA-256.
 */
export async function simulateRedirectFunction(
  shortCode: string,
  mockLink: MockLink | null,
  method: "GET" | "POST" = "GET",
  formData?: { password: string },
  headers?: Record<string, string>
): Promise<RedirectResponse> {
  const corsHeaders = normalizeHeaders({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  });

  // Validate short code format: 3–20 alphanumeric, hyphens, underscores
  if (!shortCode || !/^[A-Z0-9_-]{3,20}$/.test(shortCode)) {
    return {
      status: 400,
      headers: normalizeHeaders({ ...corsHeaders, "Content-Type": "application/json" }),
      body: JSON.stringify({ error: "Invalid short code" }),
    };
  }

  // Check if link exists
  if (!mockLink) {
    return {
      status: 404,
      headers: normalizeHeaders({ ...corsHeaders, "Content-Type": "application/json" }),
      body: JSON.stringify({ error: "Link not found or inactive" }),
    };
  }

  // Check expiration
  if (mockLink.expires_at && new Date(mockLink.expires_at) <= new Date()) {
    return {
      status: 410,
      headers: normalizeHeaders({ ...corsHeaders, "Content-Type": "text/html; charset=utf-8" }),
      body: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Link đã hết hạn</title></head>` +
        `<body><h1>Link này đã hết hạn</h1><p>Link bạn truy cập đã hết hạn và không còn hoạt động.</p></body></html>`,
    };
  }

  // Password protection — supports both PBKDF2 and legacy SHA-256 hashes
  if (mockLink.password_hash) {
    if (method === "POST" && formData) {
      const isValid = formData.password !== "" &&
        await verifyPassword(formData.password, mockLink.password_hash, mockLink.password_salt);

      if (!isValid) {
        const errorForm = buildPasswordForm(shortCode, "Mật khẩu không đúng. Vui lòng thử lại.");
        return {
          status: 401,
          headers: normalizeHeaders({ ...corsHeaders, "Content-Type": "text/html; charset=utf-8" }),
          body: errorForm,
        };
      }
      // Password correct — fall through to redirect
    } else if (method === "GET") {
      return {
        status: 200,
        headers: normalizeHeaders({ ...corsHeaders, "Content-Type": "text/html; charset=utf-8" }),
        body: buildPasswordForm(shortCode),
      };
    }
  }

  // Resolve target URL with geo-routing
  const countryCode = (headers?.["cf-ipcountry"] || "").toUpperCase();
  const targetUrl = resolveTarget(mockLink.default_url, countryCode, mockLink.geo_routes ?? []);

  // Validate redirect URL
  if (!/^https?:\/\//i.test(targetUrl)) {
    return {
      status: 400,
      headers: normalizeHeaders({ ...corsHeaders, "Content-Type": "application/json" }),
      body: JSON.stringify({ error: "Invalid redirect target" }),
    };
  }

  // Success: 302 redirect
  return {
    status: 302,
    headers: normalizeHeaders({
      ...corsHeaders,
      "Location": targetUrl,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    }),
    body: "",
  };
}
