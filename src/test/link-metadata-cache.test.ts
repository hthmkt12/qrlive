import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLinkMetadataCache } from "../../supabase/functions/_shared/link-metadata-cache";
import { withLinkMetadataCache } from "../../supabase/functions/redirect/redirect-link-cache";
import type { LinkRecord, SupabaseAdapter } from "../../supabase/functions/redirect/redirect-handler";

function makeLink(overrides: Partial<LinkRecord> = {}): LinkRecord {
  return {
    id: "link-1",
    name: "Hot Link",
    short_code: "HOT123",
    default_url: "https://example.com",
    webhook_url: null,
    geo_routes: [],
    ...overrides,
  };
}

function makeAdapter(link: LinkRecord | null): SupabaseAdapter {
  return {
    fetchLink: vi.fn().mockResolvedValue(link),
    recentClickCount: vi.fn().mockResolvedValue(0),
    insertClick: vi.fn().mockResolvedValue(undefined),
    updateLink: vi.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("link metadata cache", () => {
  it("returns null when Redis credentials are missing", () => {
    expect(createLinkMetadataCache({ restUrl: "", token: "" })).toBeNull();
  });

  it("reads cached link metadata from Redis", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ result: JSON.stringify(makeLink()) })));
    const cache = createLinkMetadataCache({
      fetchImpl,
      restUrl: "https://redis.example.com",
      token: "token",
    });

    await expect(cache!.get<LinkRecord>("HOT123")).resolves.toEqual(makeLink());
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://redis.example.com",
      expect.objectContaining({
        body: JSON.stringify(["GET", "qrlive:link:HOT123"]),
      })
    );
  });

  it("stores public links with SETEX and configured TTL", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ result: "OK" })));
    const cache = createLinkMetadataCache({
      fetchImpl,
      restUrl: "https://redis.example.com",
      token: "token",
      ttlSeconds: 45,
    });

    await cache!.set(makeLink());

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://redis.example.com",
      expect.objectContaining({
        body: JSON.stringify(["SETEX", "qrlive:link:HOT123", 45, JSON.stringify(makeLink())]),
      })
    );
  });

  it("does not cache password-protected links", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ result: "OK" })));
    const cache = createLinkMetadataCache({
      fetchImpl,
      restUrl: "https://redis.example.com",
      token: "token",
    });

    await cache!.set(makeLink({ password_hash: "pbkdf2:hash" }));

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("wraps adapter.fetchLink so cache hits skip Supabase", async () => {
    const adapter = makeAdapter(makeLink());
    const wrapped = withLinkMetadataCache(adapter, {
      get: vi.fn().mockResolvedValue(makeLink()),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    });

    await expect(wrapped.fetchLink("HOT123")).resolves.toEqual(makeLink());
    expect(adapter.fetchLink).not.toHaveBeenCalled();
  });

  it("writes DB results back into Redis on cache miss", async () => {
    const adapter = makeAdapter(makeLink());
    const set = vi.fn().mockResolvedValue(undefined);
    const wrapped = withLinkMetadataCache(adapter, {
      get: vi.fn().mockResolvedValue(null),
      set,
      delete: vi.fn().mockResolvedValue(undefined),
    });

    await wrapped.fetchLink("HOT123");

    expect(adapter.fetchLink).toHaveBeenCalledWith("HOT123");
    expect(set).toHaveBeenCalledWith(makeLink());
  });
});
