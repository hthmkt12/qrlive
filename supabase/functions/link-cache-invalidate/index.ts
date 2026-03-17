import { createClient } from "npm:@supabase/supabase-js@2";
import { createLinkMetadataCache } from "../_shared/link-metadata-cache.ts";
import {
  handleLinkCacheInvalidation,
  type LinkCacheInvalidationAdapter,
  type LinkCacheInvalidationRequest,
} from "./link-cache-invalidate-handler.ts";

function getBearerToken(authorizationHeader: string | null) {
  if (!authorizationHeader) return null;
  const [scheme, token] = authorizationHeader.split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token : null;
}

function createAdapter(authorizationHeader: string | null): LinkCacheInvalidationAdapter {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const cache = createLinkMetadataCache();

  return {
    async ownsShortCode(shortCode) {
      const jwt = getBearerToken(authorizationHeader);
      if (!jwt) return false;

      const { data, error: authError } = await supabase.auth.getUser(jwt);
      if (authError || !data.user) return false;

      const { data: link, error } = await supabase
        .from("qr_links")
        .select("id")
        .eq("short_code", shortCode)
        .eq("user_id", data.user.id)
        .maybeSingle();

      return !error && !!link;
    },
    async purge(shortCode) {
      if (!cache) return false;
      await cache.delete(shortCode);
      return true;
    },
  };
}

async function toHandlerRequest(req: Request): Promise<LinkCacheInvalidationRequest> {
  let shortCode: string | undefined;

  if (req.method === "POST") {
    try {
      const payload = await req.json();
      if (payload && typeof payload.shortCode === "string") {
        shortCode = payload.shortCode;
      }
    } catch {
      // Treat malformed JSON as empty payload.
    }
  }

  return { method: req.method, shortCode };
}

Deno.serve(async (req) => {
  const result = await handleLinkCacheInvalidation(
    await toHandlerRequest(req),
    createAdapter(req.headers.get("Authorization"))
  );

  return new Response(result.body || null, {
    status: result.status,
    headers: result.headers,
  });
});
