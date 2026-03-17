const WEBHOOK_TIMEOUT_MS = 3_000;
const BLOCKED_WEBHOOK_HOSTS = new Set(["localhost"]);
const BLOCKED_WEBHOOK_SUFFIXES = [".internal", ".lan", ".local", ".localhost", ".home"];

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

function normalizeHostname(hostname: string) {
  return hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
}

function isIPv4Literal(hostname: string) {
  const octets = hostname.split(".");
  if (octets.length !== 4) return false;
  return octets.every((octet) => /^\d+$/.test(octet) && Number(octet) >= 0 && Number(octet) <= 255);
}

function isBlockedWebhookHostname(hostname: string) {
  const normalized = normalizeHostname(hostname);
  if (!normalized) return true;
  if (BLOCKED_WEBHOOK_HOSTS.has(normalized)) return true;
  if (BLOCKED_WEBHOOK_SUFFIXES.some((suffix) => normalized.endsWith(suffix))) return true;
  if (!normalized.includes(".")) return true;
  return isIPv4Literal(normalized) || normalized.includes(":");
}

export function validateWebhookUrl(rawUrl: string) {
  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    throw new Error("WEBHOOK_URL_INVALID");
  }

  if (!/^https?:$/.test(target.protocol)) throw new Error("WEBHOOK_URL_INVALID");
  if (target.username || target.password) throw new Error("WEBHOOK_URL_INVALID");
  if (isBlockedWebhookHostname(target.hostname)) throw new Error("WEBHOOK_URL_BLOCKED");
  return target;
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
  const target = validateWebhookUrl(url);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

  try {
    const response = await fetchImpl(target.toString(), {
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
