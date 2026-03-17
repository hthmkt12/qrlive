import {
  assertWebhookUrlResolvesPublicIp,
  redactWebhookUrl,
  type ResolveDnsFn,
  validateWebhookUrl,
} from "./webhook-url-security.ts";

export { redactWebhookUrl, type ResolveDnsFn, validateWebhookUrl } from "./webhook-url-security.ts";

const WEBHOOK_TIMEOUT_MS = 3_000;

export interface ClickWebhookPayload {
  event: "click.created";
  version: 1;
  occurred_at: string;
  link: {
    id: string;
    name: string;
    short_code: string;
  };
  destination: {
    default_url: string;
    redirect_url: string;
    geo_routed: boolean;
  };
  click: {
    country_code: string;
    referer: string;
  };
}

interface BuildClickWebhookPayloadInput {
  countryCode: string;
  defaultUrl: string;
  linkId: string;
  linkName: string;
  occurredAt: string;
  redirectUrl: string;
  referer: string;
  shortCode: string;
}

export function buildClickWebhookPayload({
  countryCode,
  defaultUrl,
  linkId,
  linkName,
  occurredAt,
  redirectUrl,
  referer,
  shortCode,
}: BuildClickWebhookPayloadInput): ClickWebhookPayload {
  return {
    event: "click.created",
    version: 1,
    occurred_at: occurredAt,
    link: {
      id: linkId,
      name: linkName,
      short_code: shortCode,
    },
    destination: {
      default_url: defaultUrl,
      redirect_url: redirectUrl,
      geo_routed: redirectUrl !== defaultUrl,
    },
    click: {
      country_code: countryCode || "unknown",
      referer,
    },
  };
}

/** Compute HMAC-SHA256 signature over `timestamp.body` using Web Crypto */
export async function signWebhookPayload(secret: string, timestamp: string, body: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const data = encoder.encode(`${timestamp}.${body}`);
  const signature = await crypto.subtle.sign("HMAC", key, data);
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function dispatchClickWebhook(
  url: string,
  payload: ClickWebhookPayload,
  fetchImpl: typeof fetch = fetch,
  resolveDnsImpl?: ResolveDnsFn,
  secret?: string
) {
  const target = validateWebhookUrl(url);
  await assertWebhookUrlResolvesPublicIp(target, resolveDnsImpl);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

  try {
    const body = JSON.stringify(payload);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-QRLive-Event": payload.event,
      "X-QRLive-Version": String(payload.version),
    };

    // Add HMAC signature headers when secret is available
    if (secret) {
      const timestamp = new Date().toISOString();
      const signature = await signWebhookPayload(secret, timestamp, body);
      headers["X-QRLive-Timestamp"] = timestamp;
      headers["X-QRLive-Signature-256"] = `sha256=${signature}`;
    }

    const response = await fetchImpl(target.toString(), {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`WEBHOOK_HTTP_${response.status}`);
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

export function reportClickWebhookError(url: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Click webhook delivery failed for ${redactWebhookUrl(url)}: ${message}`);
}
