export interface LinkCacheInvalidationRequest {
  method: string;
  shortCode?: string | null;
}

export interface LinkCacheInvalidationResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export interface LinkCacheInvalidationAdapter {
  ownsShortCode(shortCode: string): Promise<boolean>;
  purge(shortCode: string): Promise<boolean>;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const JSON_HEADERS = {
  ...CORS_HEADERS,
  "Content-Type": "application/json",
};

const SHORT_CODE_PATTERN = /^[A-Z0-9_-]{3,20}$/;

export async function handleLinkCacheInvalidation(
  req: LinkCacheInvalidationRequest,
  adapter: LinkCacheInvalidationAdapter
): Promise<LinkCacheInvalidationResponse> {
  if (req.method === "OPTIONS") {
    return { status: 200, headers: CORS_HEADERS, body: "" };
  }

  if (req.method !== "POST") {
    return { status: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const shortCode = req.shortCode?.trim().toUpperCase() ?? "";
  if (!SHORT_CODE_PATTERN.test(shortCode)) {
    return { status: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: "Invalid short code" }) };
  }

  if (!(await adapter.ownsShortCode(shortCode))) {
    return { status: 403, headers: JSON_HEADERS, body: JSON.stringify({ error: "Forbidden" }) };
  }

  const purged = await adapter.purge(shortCode);
  return {
    status: 200,
    headers: JSON_HEADERS,
    body: JSON.stringify({ success: true, purged }),
  };
}
