import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Common bot/crawler user agent patterns — skip click recording for these
const BOT_PATTERN = /bot|crawler|spider|prerender|headless|facebookexternalhit|twitterbot|slurp/i;

/** SHA-256 hash of salt+password using Deno's Web Crypto API */
async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Minimal Vietnamese HTML password form for protected links */
function buildPasswordForm(shortCode: string, errorMsg?: string): string {
  const error = errorMsg
    ? `<p class="error">${errorMsg}</p>`
    : "";
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

/** Record a click event if not a bot and not rate-limited */
async function recordClick(
  supabase: ReturnType<typeof createClient>,
  linkId: string,
  ip: string,
  countryCode: string,
  userAgent: string,
  referer: string
): Promise<void> {
  if (BOT_PATTERN.test(userAgent)) return;

  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { count } = await supabase
    .from("click_events")
    .select("id", { count: "exact", head: true })
    .eq("link_id", linkId)
    .eq("ip_address", ip)
    .gte("created_at", oneMinuteAgo);

  if (!count || count === 0) {
    await supabase.from("click_events").insert({
      link_id: linkId,
      country: countryCode,
      country_code: countryCode,
      ip_address: ip,
      user_agent: userAgent,
      referer,
    });
  }
}

/** Resolve redirect target: bypass_url → target_url → default_url */
function resolveTarget(
  defaultUrl: string,
  countryCode: string,
  geoRoutes: { country_code: string; target_url: string; bypass_url?: string }[]
): string {
  if (countryCode && geoRoutes?.length > 0) {
    const route = geoRoutes.find((r) => r.country_code.toUpperCase() === countryCode);
    if (route) return route.bypass_url || route.target_url;
  }
  return defaultUrl;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const shortCode = pathParts[pathParts.length - 1];

    // Validate short code format: 3–20 uppercase alphanumeric chars, hyphens, underscores
    if (!shortCode || !/^[A-Z0-9_-]{3,20}$/.test(shortCode)) {
      return new Response(JSON.stringify({ error: "Invalid short code" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service role client bypasses RLS — needed for click_events INSERT
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Look up active link with geo routes and password fields
    const { data: link, error: linkError } = await supabase
      .from("qr_links")
      .select("id, default_url, expires_at, password_hash, password_salt, geo_routes(*)")
      .eq("short_code", shortCode)
      .eq("is_active", true)
      .single();

    if (linkError || !link) {
      return new Response(JSON.stringify({ error: "Link not found or inactive" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check expiration — expired links return 410 Gone
    if (link.expires_at && new Date(link.expires_at) <= new Date()) {
      return new Response(
        `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Link đã hết hạn</title></head>` +
        `<body><h1>Link này đã hết hạn</h1><p>Link bạn truy cập đã hết hạn và không còn hoạt động.</p></body></html>`,
        {
          status: 410,
          headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
        }
      );
    }

    // ── Password protection ───────────────────────────────────────────────────

    if (link.password_hash) {
      // POST: verify submitted password
      if (req.method === "POST") {
        let submittedPassword = "";
        try {
          const formData = await req.formData();
          submittedPassword = formData.get("password")?.toString() ?? "";
        } catch {
          // ignore parse errors — treat as wrong password
        }

        const isValid = submittedPassword !== "" &&
          await hashPassword(submittedPassword, link.password_salt) === link.password_hash;

        if (!isValid) {
          return new Response(buildPasswordForm(shortCode, "Mật khẩu không đúng. Vui lòng thử lại."), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
          });
        }
        // Password correct — fall through to redirect below
      } else {
        // GET: serve password form
        return new Response(buildPasswordForm(shortCode), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
        });
      }
    }

    // ── Analytics & redirect ──────────────────────────────────────────────────

    const userAgent = req.headers.get("user-agent") || "";
    // Truncate referer to prevent unbounded DB writes from crafted headers
    const referer = (req.headers.get("referer") || "direct").substring(0, 500);
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";
    const countryCode = (req.headers.get("cf-ipcountry") || "").toUpperCase();

    await recordClick(supabase, link.id, ip, countryCode, userAgent, referer);

    const targetUrl = resolveTarget(link.default_url, countryCode, link.geo_routes ?? []);

    // Block non-HTTP(S) URLs to prevent javascript: / data: injection
    if (!/^https?:\/\//i.test(targetUrl)) {
      return new Response(JSON.stringify({ error: "Invalid redirect target" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: targetUrl,
        // Prevent caching of redirects — each visit must hit this function for accurate analytics
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (error) {
    console.error("Redirect error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
