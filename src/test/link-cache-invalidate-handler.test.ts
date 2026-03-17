import { describe, expect, it, vi } from "vitest";
import {
  handleLinkCacheInvalidation,
  type LinkCacheInvalidationAdapter,
} from "../../supabase/functions/link-cache-invalidate/link-cache-invalidate-handler";

function makeAdapter(overrides: Partial<LinkCacheInvalidationAdapter> = {}): LinkCacheInvalidationAdapter {
  return {
    ownsShortCode: vi.fn().mockResolvedValue(true),
    purge: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe("link-cache-invalidate-handler", () => {
  it("returns 200 for OPTIONS preflight", async () => {
    const result = await handleLinkCacheInvalidation({ method: "OPTIONS" }, makeAdapter());
    expect(result.status).toBe(200);
    expect(result.headers["Access-Control-Allow-Origin"]).toBe("*");
  });

  it("rejects non-POST methods", async () => {
    const result = await handleLinkCacheInvalidation({ method: "GET", shortCode: "HOT123" }, makeAdapter());
    expect(result.status).toBe(405);
    expect(JSON.parse(result.body).error).toBe("Method not allowed");
  });

  it("rejects invalid short codes", async () => {
    const result = await handleLinkCacheInvalidation({ method: "POST", shortCode: "ab" }, makeAdapter());
    expect(result.status).toBe(400);
    expect(JSON.parse(result.body).error).toBe("Invalid short code");
  });

  it("returns 403 when the authenticated user does not own the short code", async () => {
    const result = await handleLinkCacheInvalidation(
      { method: "POST", shortCode: "HOT123" },
      makeAdapter({ ownsShortCode: vi.fn().mockResolvedValue(false) })
    );

    expect(result.status).toBe(403);
    expect(JSON.parse(result.body).error).toBe("Forbidden");
  });

  it("purges the Redis key for owned short codes", async () => {
    const purge = vi.fn().mockResolvedValue(true);
    const result = await handleLinkCacheInvalidation(
      { method: "POST", shortCode: "hot123" },
      makeAdapter({ purge })
    );

    expect(result.status).toBe(200);
    expect(purge).toHaveBeenCalledWith("HOT123");
    expect(JSON.parse(result.body)).toEqual({ success: true, purged: true });
  });
});
