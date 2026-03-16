import { createClient } from "npm:@supabase/supabase-js@2";
import {
  handleRedirect,
  type HandlerRequest,
  type SupabaseAdapter,
} from "./redirect-handler.ts";

/** Build a SupabaseAdapter backed by the real Supabase client */
function createAdapter(): SupabaseAdapter {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  return {
    async fetchLink(shortCode) {
      const { data, error } = await supabase
        .from("qr_links")
        .select("id, default_url, expires_at, password_hash, password_salt, geo_routes(*)")
        .eq("short_code", shortCode)
        .eq("is_active", true)
        .single();
      if (error || !data) return null;
      return data;
    },

    async recentClickCount(linkId, ip, sinceISO) {
      const { count } = await supabase
        .from("click_events")
        .select("id", { count: "exact", head: true })
        .eq("link_id", linkId)
        .eq("ip_address", ip)
        .gte("created_at", sinceISO);
      return count ?? 0;
    },

    async insertClick(event) {
      await supabase.from("click_events").insert(event);
    },

    async updateLink(id, fields) {
      await supabase.from("qr_links").update(fields).eq("id", id);
    },
  };
}

/** Convert Deno Request to HandlerRequest */
async function toHandlerRequest(req: Request): Promise<HandlerRequest> {
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
  });

  let formData: Record<string, string> | undefined;
  if (req.method === "POST") {
    try {
      const fd = await req.formData();
      formData = {};
      fd.forEach((value, key) => {
        formData![key] = value.toString();
      });
    } catch {
      // ignore parse errors — treat as empty form data
    }
  }

  return { method: req.method, url: req.url, headers, formData };
}

Deno.serve(async (req) => {
  const adapter = createAdapter();
  const handlerReq = await toHandlerRequest(req);
  const result = await handleRedirect(handlerReq, adapter);
  return new Response(result.body || null, {
    status: result.status,
    headers: result.headers,
  });
});
