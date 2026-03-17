const BLOCKED_WEBHOOK_HOSTS = new Set(["localhost"]);
const BLOCKED_WEBHOOK_SUFFIXES = [
  ".internal",
  ".lan",
  ".local",
  ".localhost",
  ".home",
  ".localtest.me",
  ".lvh.me",
  ".nip.io",
  ".sslip.io",
  ".xip.io",
];

export type ResolveDnsFn = (hostname: string, recordType: "A" | "AAAA") => Promise<string[]>;

function normalizeHostname(hostname: string) {
  return hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
}

function isIPv4Literal(hostname: string) {
  const octets = hostname.split(".");
  if (octets.length !== 4) return false;
  return octets.every((octet) => /^\d+$/.test(octet) && Number(octet) >= 0 && Number(octet) <= 255);
}

function parseIPv4Octets(hostname: string) {
  if (!isIPv4Literal(hostname)) return null;
  return hostname.split(".").map(Number);
}

function isPrivateOrReservedIPv4(hostname: string) {
  const octets = parseIPv4Octets(hostname);
  if (!octets) return false;

  const [first, second, third] = octets;
  return first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0 && (third === 0 || third === 2)) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19 || second === 51)) ||
    (first === 203 && second === 0 && third === 113) ||
    first >= 224;
}

function isPrivateOrReservedIPv6(hostname: string) {
  const normalized = normalizeHostname(hostname);
  if (!normalized.includes(":")) return false;
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fe80:")) return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("2001:db8")) return true;
  if (normalized.startsWith("::ffff:")) return isPrivateOrReservedIp(normalized.slice(7));
  return false;
}

function isPrivateOrReservedIp(hostname: string) {
  return isPrivateOrReservedIPv4(hostname) || isPrivateOrReservedIPv6(hostname);
}

function isBlockedWebhookHostname(hostname: string) {
  const normalized = normalizeHostname(hostname);
  if (!normalized) return true;
  if (BLOCKED_WEBHOOK_HOSTS.has(normalized)) return true;
  if (BLOCKED_WEBHOOK_SUFFIXES.some((suffix) => normalized.endsWith(suffix))) return true;
  if (!normalized.includes(".")) return true;
  return isIPv4Literal(normalized) || normalized.includes(":");
}

function getDefaultResolveDns(): ResolveDnsFn {
  const deno = (globalThis as typeof globalThis & {
    Deno?: { resolveDns?: ResolveDnsFn };
  }).Deno;

  if (!deno?.resolveDns) {
    throw new Error("WEBHOOK_DNS_UNAVAILABLE");
  }

  return deno.resolveDns.bind(deno);
}

async function resolveWebhookHostnameAddresses(hostname: string, resolveDnsImpl: ResolveDnsFn) {
  const normalized = normalizeHostname(hostname);
  const lookups = await Promise.allSettled([
    resolveDnsImpl(normalized, "A"),
    resolveDnsImpl(normalized, "AAAA"),
  ]);
  const addresses = [...new Set(lookups
    .flatMap((result) => result.status === "fulfilled" ? result.value : [])
    .map((address) => normalizeHostname(address)))];

  if (addresses.length === 0) {
    const rejected = lookups.find((result) => result.status === "rejected");
    throw rejected?.status === "rejected" && rejected.reason instanceof Error
      ? rejected.reason
      : new Error("WEBHOOK_DNS_LOOKUP_FAILED");
  }

  return addresses;
}

export function validateWebhookUrl(rawUrl: string) {
  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    throw new Error("WEBHOOK_URL_INVALID");
  }

  if (target.protocol !== "https:") throw new Error("WEBHOOK_URL_INVALID");
  if (target.username || target.password) throw new Error("WEBHOOK_URL_INVALID");
  if (isBlockedWebhookHostname(target.hostname)) throw new Error("WEBHOOK_URL_BLOCKED");
  return target;
}

export async function assertWebhookUrlResolvesPublicIp(target: URL, resolveDnsImpl?: ResolveDnsFn) {
  const addresses = await resolveWebhookHostnameAddresses(target.hostname, resolveDnsImpl ?? getDefaultResolveDns());
  if (addresses.some((address) => isPrivateOrReservedIp(address))) {
    throw new Error("WEBHOOK_URL_BLOCKED");
  }
}

export function redactWebhookUrl(rawUrl: string) {
  try {
    const target = new URL(rawUrl);
    return `${target.origin}/...`;
  } catch {
    return "[invalid webhook url]";
  }
}
