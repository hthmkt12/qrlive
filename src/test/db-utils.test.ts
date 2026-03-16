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
import { fetchLinkAnalyticsDetail, fetchLinkAnalyticsSummaries, fetchLinks, getRedirectUrl } from "@/lib/db";

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
    expect(select).toHaveBeenCalledWith("id, user_id, name, short_code, default_url, is_active, created_at, expires_at, password_hash, geo_routes(*)");
    expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
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
