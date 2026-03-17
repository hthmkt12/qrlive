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

export async function dispatchClickWebhook(
  url: string,
  payload: ClickWebhookPayload,
  fetchImpl: typeof fetch = fetch
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-QRLive-Event": payload.event,
        "X-QRLive-Version": String(payload.version),
      },
      body: JSON.stringify(payload),
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
  console.error(`Click webhook delivery failed for ${url}: ${message}`);
}
