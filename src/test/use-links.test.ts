import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

// Mock db functions
vi.mock("@/lib/db", () => ({
  fetchLinks: vi.fn().mockResolvedValue([]),
  fetchLinkAnalyticsSummaries: vi.fn().mockResolvedValue([]),
  fetchLinkAnalyticsDetail: vi.fn().mockResolvedValue({
    link_id: "link-1",
    total_clicks: 0,
    today_clicks: 0,
    countries_count: 0,
    clicks_by_day: [],
    country_breakdown: [],
    referer_breakdown: [],
  }),
  fetchLinkAnalyticsDetailV2: vi.fn().mockResolvedValue({
    link_id: "link-1",
    total_clicks: 0,
    today_clicks: 0,
    countries_count: 0,
    clicks_by_day: [],
    country_breakdown: [],
    referer_breakdown: [],
  }),
}));

// Mock supabase auth for AuthProvider dependency
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: vi.fn(), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })) },
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

import {
  fetchLinks,
  fetchLinkAnalyticsSummaries,
  fetchLinkAnalyticsDetail,
  fetchLinkAnalyticsDetailV2,
} from "@/lib/db";
import {
  useLinks,
  useLinkAnalyticsSummaries,
  useLinkAnalyticsDetail,
  useLinkAnalyticsDetailV2,
} from "@/hooks/use-links";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function makeWrapper(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useLinks", () => {
  it("fetches links on mount", async () => {
    const qc = makeQueryClient();
    const { result } = renderHook(() => useLinks(), { wrapper: makeWrapper(qc) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchLinks).toHaveBeenCalledOnce();
  });

  it("returns data from fetchLinks", async () => {
    vi.mocked(fetchLinks).mockResolvedValue([
      { id: "1", name: "Test", short_code: "ABC", default_url: "https://x.com" } as never,
    ]);
    const qc = makeQueryClient();
    const { result } = renderHook(() => useLinks(), { wrapper: makeWrapper(qc) });

    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(result.current.data![0].id).toBe("1");
  });
});

describe("useLinkAnalyticsSummaries", () => {
  it("does not fetch when linkIds is empty", async () => {
    const qc = makeQueryClient();
    renderHook(() => useLinkAnalyticsSummaries([]), { wrapper: makeWrapper(qc) });

    // Wait a tick to ensure no fetch was triggered
    await new Promise((r) => setTimeout(r, 50));
    expect(fetchLinkAnalyticsSummaries).not.toHaveBeenCalled();
  });

  it("fetches when linkIds has values", async () => {
    const qc = makeQueryClient();
    const { result } = renderHook(
      () => useLinkAnalyticsSummaries(["link-1", "link-2"]),
      { wrapper: makeWrapper(qc) }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchLinkAnalyticsSummaries).toHaveBeenCalledWith(["link-1", "link-2"]);
  });

  it("sorts linkIds for cache consistency", async () => {
    const qc = makeQueryClient();
    const { result } = renderHook(
      () => useLinkAnalyticsSummaries(["z-link", "a-link"]),
      { wrapper: makeWrapper(qc) }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchLinkAnalyticsSummaries).toHaveBeenCalledWith(["a-link", "z-link"]);
  });
});

describe("useLinkAnalyticsDetail", () => {
  it("does not fetch when linkId is null", async () => {
    const qc = makeQueryClient();
    renderHook(() => useLinkAnalyticsDetail(null), { wrapper: makeWrapper(qc) });

    await new Promise((r) => setTimeout(r, 50));
    expect(fetchLinkAnalyticsDetail).not.toHaveBeenCalled();
  });

  it("fetches when linkId is provided", async () => {
    const qc = makeQueryClient();
    const { result } = renderHook(
      () => useLinkAnalyticsDetail("link-1"),
      { wrapper: makeWrapper(qc) }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchLinkAnalyticsDetail).toHaveBeenCalledWith("link-1");
  });
});

describe("useLinkAnalyticsDetailV2", () => {
  it("does not fetch when linkId is null", async () => {
    const qc = makeQueryClient();
    renderHook(() => useLinkAnalyticsDetailV2(null), { wrapper: makeWrapper(qc) });

    await new Promise((r) => setTimeout(r, 50));
    expect(fetchLinkAnalyticsDetailV2).not.toHaveBeenCalled();
  });

  it("fetches with linkId and date params", async () => {
    const qc = makeQueryClient();
    const { result } = renderHook(
      () => useLinkAnalyticsDetailV2("link-1", "2026-03-01", "2026-03-16"),
      { wrapper: makeWrapper(qc) }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchLinkAnalyticsDetailV2).toHaveBeenCalledWith("link-1", "2026-03-01", "2026-03-16", undefined);
  });

  it("fetches without date params when omitted", async () => {
    const qc = makeQueryClient();
    const { result } = renderHook(
      () => useLinkAnalyticsDetailV2("link-1"),
      { wrapper: makeWrapper(qc) }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchLinkAnalyticsDetailV2).toHaveBeenCalledWith("link-1", undefined, undefined, undefined);
  });

  it("fetches with country filter when provided", async () => {
    const qc = makeQueryClient();
    const { result } = renderHook(
      () => useLinkAnalyticsDetailV2("link-1", "2026-03-01", "2026-03-16", "VN"),
      { wrapper: makeWrapper(qc) }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchLinkAnalyticsDetailV2).toHaveBeenCalledWith("link-1", "2026-03-01", "2026-03-16", "VN");
  });
});
