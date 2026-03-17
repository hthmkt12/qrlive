export interface CacheableLinkRecord {
  short_code: string;
  expires_at?: string | null;
  password_hash?: string | null;
}

export interface LinkMetadataCache {
  get<T>(shortCode: string): Promise<T | null>;
  set<T extends CacheableLinkRecord>(link: T): Promise<void>;
  delete(shortCode: string): Promise<void>;
}

interface LinkMetadataCacheOptions {
  fetchImpl?: typeof fetch;
  keyPrefix?: string;
  restUrl?: string | null;
  token?: string | null;
  ttlSeconds?: number;
}

interface RedisRestResponse<T> {
  result?: T;
  error?: string;
}

export const DEFAULT_LINK_CACHE_PREFIX = "qrlive:link:";
export const DEFAULT_LINK_CACHE_TTL_SECONDS = 60;

function readEnv(name: string) {
  return typeof Deno === "undefined" ? undefined : Deno.env.get(name) ?? undefined;
}

function normalizeBaseUrl(restUrl: string) {
  return restUrl.endsWith("/") ? restUrl.slice(0, -1) : restUrl;
}

function parsePositiveInt(value: number | string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function resolveLinkTtlSeconds(expiresAt: string | null | undefined, fallback: number) {
  if (!expiresAt) return fallback;
  const remainingSeconds = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000);
  if (!Number.isFinite(remainingSeconds) || remainingSeconds <= 0) return 0;
  return Math.max(1, Math.min(fallback, remainingSeconds));
}

function shouldCacheLink(link: CacheableLinkRecord) {
  return !link.password_hash;
}

export function buildLinkCacheKey(shortCode: string, keyPrefix = DEFAULT_LINK_CACHE_PREFIX) {
  return `${keyPrefix}${shortCode.trim().toUpperCase()}`;
}

export function createLinkMetadataCache(options: LinkMetadataCacheOptions = {}): LinkMetadataCache | null {
  const restUrl = options.restUrl ?? readEnv("UPSTASH_REDIS_REST_URL");
  const token = options.token ?? readEnv("UPSTASH_REDIS_REST_TOKEN");
  if (!restUrl || !token) return null;

  const fetchImpl = options.fetchImpl ?? fetch;
  const ttlSeconds = parsePositiveInt(
    options.ttlSeconds ?? readEnv("UPSTASH_REDIS_LINK_TTL_SECONDS"),
    DEFAULT_LINK_CACHE_TTL_SECONDS
  );
  const keyPrefix = options.keyPrefix ?? readEnv("UPSTASH_REDIS_LINK_KEY_PREFIX") ?? DEFAULT_LINK_CACHE_PREFIX;
  const baseUrl = normalizeBaseUrl(restUrl);

  async function runCommand<T>(command: Array<string | number>) {
    const response = await fetchImpl(baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
    });

    const payload = await response.json() as RedisRestResponse<T>;
    if (!response.ok || payload.error) {
      throw new Error(payload.error || `Redis cache request failed with status ${response.status}`);
    }
    return payload.result ?? null;
  }

  return {
    async get<T>(shortCode) {
      const key = buildLinkCacheKey(shortCode, keyPrefix);
      const rawValue = await runCommand<string>(["GET", key]);
      if (!rawValue) return null;

      try {
        return JSON.parse(rawValue) as T;
      } catch {
        await runCommand(["DEL", key]);
        return null;
      }
    },
    async set(link) {
      if (!shouldCacheLink(link)) return;

      const ttlForLink = resolveLinkTtlSeconds(link.expires_at, ttlSeconds);
      if (ttlForLink <= 0) return;

      await runCommand([
        "SETEX",
        buildLinkCacheKey(link.short_code, keyPrefix),
        ttlForLink,
        JSON.stringify(link),
      ]);
    },
    async delete(shortCode) {
      await runCommand(["DEL", buildLinkCacheKey(shortCode, keyPrefix)]);
    },
  };
}
