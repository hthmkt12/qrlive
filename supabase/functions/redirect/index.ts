import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Common bot/crawler user agent patterns — skip click recording for these
const BOT_PATTERN = /bot|crawler|spider|prerender|headless|facebookexternalhit|twitterbot|slurp/i;

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

    // Look up active link with geo routes
    const { data: link, error: linkError } = await supabase
      .from("qr_links")
      .select("*, geo_routes(*)")
      .eq("short_code", shortCode)
      .eq("is_active", true)
      .single();

    if (linkError || !link) {
      return new Response(JSON.stringify({ error: "Link not found or inactive" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userAgent = req.headers.get("user-agent") || "";
    // Truncate referer to prevent unbounded DB writes from crafted headers
    const referer = (req.headers.get("referer") || "direct").substring(0, 500);
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";

    // Use Cloudflare's cf-ipcountry header — available on all Supabase edge deployments.
    // No fallback to ip-api.com (rate-limited, adds latency). If header absent (local dev),
    // country stays empty and visitor falls through to default_url.
    const countryCode = (req.headers.get("cf-ipcountry") || "").toUpperCase();

    // Record click only for real users — skip bots to keep analytics clean
    if (!BOT_PATTERN.test(userAgent)) {
      // Rate limit: skip if same IP clicked this link within the last 60 seconds
      const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
      const { count } = await supabase
        .from("click_events")
        .select("id", { count: "exact", head: true })
        .eq("link_id", link.id)
        .eq("ip_address", ip)
        .gte("created_at", oneMinuteAgo);

      if (!count || count === 0) {
        await supabase.from("click_events").insert({
          link_id: link.id,
          country: countryCode,
          country_code: countryCode,
          ip_address: ip,
          user_agent: userAgent,
          referer,
        });
      }
    }

    // Resolve redirect target: bypass_url → target_url → default_url
    let targetUrl = link.default_url;
    if (countryCode && link.geo_routes?.length > 0) {
      const geoRoute = link.geo_routes.find(
        (r: { country_code: string; target_url: string; bypass_url?: string }) =>
          r.country_code.toUpperCase() === countryCode
      );
      if (geoRoute) {
        // bypass_url takes priority when set (Phase 09 feature)
        targetUrl = geoRoute.bypass_url || geoRoute.target_url;
      }
    }

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
