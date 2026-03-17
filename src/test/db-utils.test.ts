import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase client before importing db module
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: { getSession: vi.fn(), onAuthStateChange: vi.fn() },
  },
}));

import { supabase } from "@/integrations/supabase/client";
import { fetchLinkAnalyticsDetail, fetchLinkAnalyticsDetailV2, fetchLinkAnalyticsSummaries, fetchLinks, getRedirectUrl } from "@/lib/db";
import { QUERY_KEYS } from "@/lib/query-keys";

// ─── getRedirectUrl ───────────────────────────────────────────────────────────

describe("getRedirectUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VITE_SUPABASE_URL", "https://test-project.supabase.co");
  });

  it("returns correct redirect URL for a given short code", () => {
    const url = getRedirectUrl("ABC123");
    expect(url).toBe("https://test-project.supabase.co/functions/v1/redirect/ABC123");
  });

  it("includes the short code verbatim", () => {
    const url = getRedirectUrl("XYZ999");
    expect(url).toContain("XYZ999");
  });

  it("always ends with the short code", () => {
    const code = "QR1234";
    const url = getRedirectUrl(code);
    expect(url.endsWith(code)).toBe(true);
  });

  it("uses VITE_REDIRECT_BASE_URL when set (custom domain branch)", () => {
    vi.stubEnv("VITE_REDIRECT_BASE_URL", "https://r.example.com");
    const url = getRedirectUrl("ABC123");
    expect(url).toBe("https://r.example.com/ABC123");
    vi.unstubAllEnvs();
  });

  it("falls back to Supabase URL when VITE_REDIRECT_BASE_URL is not set", () => {
    vi.stubEnv("VITE_REDIRECT_BASE_URL", "");
    const url = getRedirectUrl("ABC123");
    expect(url).toContain("supabase.co/functions/v1/redirect/ABC123");
    vi.unstubAllEnvs();
  });
});

describe("analytics queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetchLinks omits raw click_events from the dashboard list query", async () => {
    const order = vi.fn().mockResolvedValue({ data: [], error: null });
    const select = vi.fn().mockReturnValue({ order });
    vi.mocked(supabase.from).mockReturnValue({ select } as never);

    await fetchLinks();

    expect(supabase.from).toHaveBeenCalledWith("qr_links");
    expect(select).toHaveBeenCalledWith("id, user_id, name, short_code, default_url, webhook_url, is_active, created_at, expires_at, has_password, has_webhook_secret, qr_config, geo_routes(*)");
    expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("fetchLinks falls back when has_webhook_secret is not deployed yet", async () => {
    const order = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: { code: "42703", message: "column qr_links.has_webhook_secret does not exist" },
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: "link-1",
            user_id: "user-1",
            name: "Fallback Link",
            short_code: "ABC123",
            default_url: "https://example.com",
            webhook_url: null,
            is_active: true,
            created_at: "2026-03-17T00:00:00Z",
            expires_at: null,
            has_password: false,
            qr_config: null,
            geo_routes: [],
          },
        ],
        error: null,
      });
    const select = vi.fn().mockReturnValue({ order });
    vi.mocked(supabase.from).mockReturnValue({ select } as never);

    await expect(fetchLinks()).resolves.toEqual([
      expect.objectContaining({
        id: "link-1",
        has_webhook_secret: false,
      }),
    ]);
    expect(select).toHaveBeenNthCalledWith(
      1,
      "id, user_id, name, short_code, default_url, webhook_url, is_active, created_at, expires_at, has_password, has_webhook_secret, qr_config, geo_routes(*)"
    );
    expect(select).toHaveBeenNthCalledWith(
      2,
      "id, user_id, name, short_code, default_url, webhook_url, is_active, created_at, expires_at, has_password, qr_config, geo_routes(*)"
    );
  });

  it("fetchLinkAnalyticsSummaries uses the aggregate rpc and normalizes counts", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [{ link_id: "link-1", total_clicks: "5", today_clicks: "2", top_country_code: "VN" }],
      error: null,
    } as never);

    await expect(fetchLinkAnalyticsSummaries(["link-1"])).resolves.toEqual([
      { link_id: "link-1", total_clicks: 5, today_clicks: 2, top_country_code: "VN" },
    ]);
    expect(supabase.rpc).toHaveBeenCalledWith("get_link_click_summaries", {
      p_link_ids: ["link-1"],
    });
  });

  it("fetchLinkAnalyticsDetail uses the detail rpc and normalizes nested breakdowns", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [
        {
          link_id: "link-1",
          total_clicks: "5",
          today_clicks: "2",
          countries_count: "2",
          clicks_by_day: [{ date: "2026-03-10", clicks: "3" }],
          country_breakdown: [{ country_code: "VN", clicks: "4" }],
          referer_breakdown: [{ referer: "direct", clicks: "5" }],
        },
      ],
      error: null,
    } as never);

    await expect(fetchLinkAnalyticsDetail("link-1")).resolves.toEqual({
      link_id: "link-1",
      total_clicks: 5,
      today_clicks: 2,
      countries_count: 2,
      clicks_by_day: [{ date: "2026-03-10", clicks: 3 }],
      country_breakdown: [{ country_code: "VN", clicks: 4 }],
      referer_breakdown: [{ referer: "direct", clicks: 5 }],
    });
    expect(supabase.rpc).toHaveBeenCalledWith("get_link_click_detail", {
      p_link_id: "link-1",
    });
  });

  it("fetchLinkAnalyticsDetail returns an empty detail payload when rpc returns no rows", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [],
      error: null,
    } as never);

    await expect(fetchLinkAnalyticsDetail("link-1")).resolves.toEqual({
      link_id: "link-1",
      total_clicks: 0,
      today_clicks: 0,
      countries_count: 0,
      clicks_by_day: [],
      country_breakdown: [],
      referer_breakdown: [],
    });
  });
});

// ─── Short code format ────────────────────────────────────────────────────────
// AUTO-GENERATED codes: 6 uppercase alphanumeric (generateShortCode)
// CUSTOM codes: 3–20 uppercase alphanumeric, hyphens, underscores (redirect validator)

describe("auto-generated short code format", () => {
  // generateShortCode always produces 6 uppercase alphanumeric chars
  const AUTO_CODE_PATTERN = /^[A-Z0-9]{6}$/;

  it("validates 6-char uppercase alphanumeric codes", () => {
    const validCodes = ["ABC123", "ZZZZZZ", "000000", "A1B2C3"];
    validCodes.forEach((code) => {
      expect(AUTO_CODE_PATTERN.test(code)).toBe(true);
    });
  });

  it("rejects lowercase codes", () => {
    expect(AUTO_CODE_PATTERN.test("abc123")).toBe(false);
  });

  it("rejects codes not exactly 6 chars", () => {
    expect(AUTO_CODE_PATTERN.test("AB12")).toBe(false);
    expect(AUTO_CODE_PATTERN.test("ABCDEFG")).toBe(false);
  });
});

describe("custom short code format contract", () => {
  // Must match redirect validator in supabase/functions/redirect/index.ts
  const CUSTOM_CODE_PATTERN = /^[A-Z0-9_-]{3,20}$/;

  it("accepts 6-char auto-generated codes (backwards compat)", () => {
    expect(CUSTOM_CODE_PATTERN.test("ABC123")).toBe(true);
  });

  it("accepts codes with hyphens and underscores", () => {
    expect(CUSTOM_CODE_PATTERN.test("MY-LINK")).toBe(true);
    expect(CUSTOM_CODE_PATTERN.test("MY_LINK")).toBe(true);
    expect(CUSTOM_CODE_PATTERN.test("A-B_C")).toBe(true);
  });

  it("accepts minimum length (3 chars)", () => {
    expect(CUSTOM_CODE_PATTERN.test("ABC")).toBe(true);
  });

  it("accepts maximum length (20 chars)", () => {
    expect(CUSTOM_CODE_PATTERN.test("ABCDEFGHIJ1234567890")).toBe(true);
  });

  it("rejects codes shorter than 3 chars", () => {
    expect(CUSTOM_CODE_PATTERN.test("AB")).toBe(false);
  });

  it("rejects codes longer than 20 chars", () => {
    expect(CUSTOM_CODE_PATTERN.test("ABCDEFGHIJ12345678901")).toBe(false);
  });

  it("rejects lowercase codes", () => {
    expect(CUSTOM_CODE_PATTERN.test("my-link")).toBe(false);
  });

  it("rejects codes with spaces or invalid chars", () => {
    expect(CUSTOM_CODE_PATTERN.test("AB 123")).toBe(false);
    expect(CUSTOM_CODE_PATTERN.test("AB.123")).toBe(false);
    expect(CUSTOM_CODE_PATTERN.test("AB@123")).toBe(false);
  });
});

// ─── fetchLinkAnalyticsDetailV2 ───────────────────────────────────────────────

describe("fetchLinkAnalyticsDetailV2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls get_link_click_detail_v3 RPC with link_id, date params, and country filter", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [
        {
          link_id: "link-1",
          total_clicks: "10",
          today_clicks: "3",
          countries_count: "2",
          clicks_by_day: [{ date: "2026-03-10", clicks: "5" }],
          country_breakdown: [{ country_code: "VN", clicks: "8" }],
          referer_breakdown: [{ referer: "direct", clicks: "10" }],
        },
      ],
      error: null,
    } as never);

    const result = await fetchLinkAnalyticsDetailV2("link-1", "2026-03-10", "2026-03-16", "VN");

    expect(supabase.rpc).toHaveBeenCalledWith("get_link_click_detail_v3", {
      p_link_id: "link-1",
      p_start_date: "2026-03-10",
      p_end_date: "2026-03-16",
      p_country_code: "VN",
    });
    expect(result.total_clicks).toBe(10);
    expect(result.clicks_by_day).toEqual([{ date: "2026-03-10", clicks: 5 }]);
  });

  it("calls RPC without date params when not provided", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as never);

    await fetchLinkAnalyticsDetailV2("link-2");

    expect(supabase.rpc).toHaveBeenCalledWith("get_link_click_detail_v3", {
      p_link_id: "link-2",
    });
  });

  it("returns empty payload when RPC returns no rows", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as never);

    const result = await fetchLinkAnalyticsDetailV2("link-1", "2026-03-01", "2026-03-31");

    expect(result).toEqual({
      link_id: "link-1",
      total_clicks: 0,
      today_clicks: 0,
      countries_count: 0,
      clicks_by_day: [],
      country_breakdown: [],
      referer_breakdown: [],
    });
  });

  it("normalizes numeric strings from RPC response", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [
        {
          link_id: "link-1",
          total_clicks: "42",
          today_clicks: "7",
          countries_count: "3",
          clicks_by_day: [],
          country_breakdown: [],
          referer_breakdown: [],
        },
      ],
      error: null,
    } as never);

    const result = await fetchLinkAnalyticsDetailV2("link-1");

    expect(result.total_clicks).toBe(42);
    expect(result.today_clicks).toBe(7);
    expect(result.countries_count).toBe(3);
  });
});

// ─── QUERY_KEYS.analytics.detailV2 ───────────────────────────────────────────

describe("QUERY_KEYS.analytics.detailV2", () => {
  it("includes link id and date params in cache key", () => {
    const key = QUERY_KEYS.analytics.detailV2("link-1", "2026-03-01", "2026-03-31");
    expect(key).toContain("link-1");
    expect(key).toContain("2026-03-01");
    expect(key).toContain("2026-03-31");
  });

  it("uses 'default' placeholder when dates are omitted", () => {
    const key = QUERY_KEYS.analytics.detailV2("link-1");
    expect(key).toContain("default");
    expect(key).toContain("all");
  });

  it("produces different keys for different date ranges", () => {
    const key7d = QUERY_KEYS.analytics.detailV2("link-1", "2026-03-10", "2026-03-16");
    const key30d = QUERY_KEYS.analytics.detailV2("link-1", "2026-02-15", "2026-03-16");
    expect(key7d).not.toEqual(key30d);
  });

  it("produces different keys for different link ids", () => {
    const keyA = QUERY_KEYS.analytics.detailV2("link-A", "2026-03-10", "2026-03-16");
    const keyB = QUERY_KEYS.analytics.detailV2("link-B", "2026-03-10", "2026-03-16");
    expect(keyA).not.toEqual(keyB);
  });

  it("produces different keys for different country filters", () => {
    const keyAll = QUERY_KEYS.analytics.detailV2("link-1", "2026-03-10", "2026-03-16");
    const keyVn = QUERY_KEYS.analytics.detailV2("link-1", "2026-03-10", "2026-03-16", "VN");
    expect(keyAll).not.toEqual(keyVn);
  });
});
