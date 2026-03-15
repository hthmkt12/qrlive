const DEFAULT_PORT = 8080;
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_REDIRECTS = 0;

function readInteger(env, name, fallback) {
  const raw = env[name];
  if (!raw) return fallback;

  const value = Number.parseInt(raw, 10);
  if (Number.isNaN(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }

  return value;
}

function readRequiredUrl(env, name) {
  const raw = env[name];
  if (!raw) {
    throw new Error(`${name} is required`);
  }

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(`${name} must use http or https`);
  }

  return url;
}

function readOptionalProxyUrl(env, name) {
  const raw = env[name];
  if (!raw) return null;

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${name} must be a valid proxy URL`);
  }

  const supported = ["http:", "https:", "socks5:", "socks5h:"];
  if (!supported.includes(url.protocol)) {
    throw new Error(`${name} must use one of: ${supported.join(", ")}`);
  }

  return url;
}

export function loadConfig(env = process.env) {
  const upstreamOrigin = readRequiredUrl(env, "UPSTREAM_ORIGIN");
  const outboundProxyUrl = readOptionalProxyUrl(env, "OUTBOUND_PROXY_URL");

  return {
    port: readInteger(env, "PORT", DEFAULT_PORT),
    requestTimeoutMs: readInteger(env, "REQUEST_TIMEOUT_MS", DEFAULT_TIMEOUT_MS),
    maxRedirects: readInteger(env, "MAX_REDIRECTS", DEFAULT_MAX_REDIRECTS),
    upstreamOrigin,
    outboundProxyUrl,
    // F13: hide upstreamOrigin from /health to avoid GFW scanner fingerprinting (default: hidden)
    healthRevealUpstream: (env.HEALTH_REVEAL_UPSTREAM ?? "false").toLowerCase() === "true",
  };
}
