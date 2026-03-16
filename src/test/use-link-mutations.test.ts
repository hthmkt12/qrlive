import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import {
  useCreateLink,
  useUpdateLink,
  useToggleActive,
  useUpdateGeoRoutes,
  useDeleteLink,
} from "@/hooks/use-link-mutations";
import { QUERY_KEYS } from "@/lib/query-keys";
import type { QRLinkRow } from "@/lib/db";

// ─── Mock @/lib/db ────────────────────────────────────────────────────────────
// vi.hoisted ensures mock fns are available before vi.mock factory runs

const {
  mockCreateLinkInDB,
  mockUpdateLinkInDB,
  mockUpdateGeoRoutesInDB,
  mockDeleteLinkInDB,
} = vi.hoisted(() => ({
  mockCreateLinkInDB: vi.fn(),
  mockUpdateLinkInDB: vi.fn(),
  mockUpdateGeoRoutesInDB: vi.fn(),
  mockDeleteLinkInDB: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  createLinkInDB: mockCreateLinkInDB,
  updateLinkInDB: mockUpdateLinkInDB,
  updateGeoRoutesInDB: mockUpdateGeoRoutesInDB,
  deleteLinkInDB: mockDeleteLinkInDB,
}));

// ─── Test helpers ─────────────────────────────────────────────────────────────

/** Fresh QueryClient with retries disabled to avoid async noise in tests */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

/** Wrapper factory that provides a QueryClient for renderHook */
function makeWrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

const mockLink: QRLinkRow = {
  id: "link-1",
  user_id: "user-1",
  name: "Test Link",
  short_code: "ABC123",
  default_url: "https://example.com",
  is_active: true,
  created_at: "2024-01-01T00:00:00Z",
  expires_at: null,
  geo_routes: [],
  password_hash: null,
  password_salt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── useCreateLink ────────────────────────────────────────────────────────────

describe("useCreateLink", () => {
  it("calls createLinkInDB with auto short code (no customShortCode)", async () => {
    const qc = makeQueryClient();
    mockCreateLinkInDB.mockResolvedValue(mockLink);

    const { result } = renderHook(() => useCreateLink(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      await result.current.mutateAsync({
        name: "My Link",
        defaultUrl: "https://example.com",
        geoRoutes: [],
        userId: "user-1",
      });
    });

    expect(mockCreateLinkInDB).toHaveBeenCalledWith(
      "My Link",
      "https://example.com",
      [],
      "user-1",
      undefined,
      undefined,
      undefined
    );
  });

  it("calls createLinkInDB with custom short code when provided", async () => {
    const qc = makeQueryClient();
    mockCreateLinkInDB.mockResolvedValue(mockLink);

    const { result } = renderHook(() => useCreateLink(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      await result.current.mutateAsync({
        name: "My Link",
        defaultUrl: "https://example.com",
        geoRoutes: [],
        userId: "user-1",
        customShortCode: "MYCODE",
      });
    });

    expect(mockCreateLinkInDB).toHaveBeenCalledWith(
      "My Link",
      "https://example.com",
      [],
      "user-1",
      "MYCODE",
      undefined,
      undefined
    );
  });

  it("propagates SHORT_CODE_TAKEN error to caller", async () => {
    const qc = makeQueryClient();
    mockCreateLinkInDB.mockRejectedValue(new Error("SHORT_CODE_TAKEN"));

    const { result } = renderHook(() => useCreateLink(), { wrapper: makeWrapper(qc) });

    await expect(
      act(async () => {
        await result.current.mutateAsync({
          name: "My Link",
          defaultUrl: "https://example.com",
          geoRoutes: [],
          userId: "user-1",
          customShortCode: "TAKEN",
        });
      })
    ).rejects.toThrow("SHORT_CODE_TAKEN");
  });

  it("invalidates links and analytics queries on success", async () => {
    const qc = makeQueryClient();
    mockCreateLinkInDB.mockResolvedValue(mockLink);
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    const { result } = renderHook(() => useCreateLink(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      await result.current.mutateAsync({
        name: "My Link",
        defaultUrl: "https://example.com",
        geoRoutes: [],
        userId: "user-1",
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.links });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.analytics.all });
  });
});

// ─── useUpdateLink ────────────────────────────────────────────────────────────

describe("useUpdateLink", () => {
  it("calls updateLinkInDB with correct args on success", async () => {
    const qc = makeQueryClient();
    mockUpdateLinkInDB.mockResolvedValue(undefined);

    const { result } = renderHook(() => useUpdateLink(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      await result.current.mutateAsync({ id: "link-1", updates: { name: "New Name" } });
    });

    expect(mockUpdateLinkInDB).toHaveBeenCalledWith("link-1", { name: "New Name" }, undefined);
  });

  it("invalidates links query on success", async () => {
    const qc = makeQueryClient();
    mockUpdateLinkInDB.mockResolvedValue(undefined);
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    const { result } = renderHook(() => useUpdateLink(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      await result.current.mutateAsync({ id: "link-1", updates: { name: "New Name" } });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.links });
  });
});

// ─── useToggleActive ──────────────────────────────────────────────────────────

describe("useToggleActive", () => {
  it("applies optimistic update to cache before DB call resolves", async () => {
    const qc = makeQueryClient();
    // Pre-populate cache with one active link
    qc.setQueryData<QRLinkRow[]>(QUERY_KEYS.links, [mockLink]);

    // updateLinkInDB resolves slowly — we check cache mid-flight
    mockUpdateLinkInDB.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 50))
    );

    const { result } = renderHook(() => useToggleActive(), { wrapper: makeWrapper(qc) });

    // Fire mutation but don't await — check optimistic state immediately
    act(() => {
      result.current.mutate({ id: "link-1", isActive: false });
    });

    // Optimistic update should be applied synchronously after onMutate
    await waitFor(() => {
      const cached = qc.getQueryData<QRLinkRow[]>(QUERY_KEYS.links);
      expect(cached?.[0]?.is_active).toBe(false);
    });
  });

  it("rolls back optimistic update on DB error", async () => {
    const qc = makeQueryClient();
    qc.setQueryData<QRLinkRow[]>(QUERY_KEYS.links, [mockLink]);
    mockUpdateLinkInDB.mockRejectedValue(new Error("DB error"));

    const { result } = renderHook(() => useToggleActive(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      result.current.mutate({ id: "link-1", isActive: false });
    });

    // After error, cache should be rolled back to original value
    await waitFor(() => {
      const cached = qc.getQueryData<QRLinkRow[]>(QUERY_KEYS.links);
      expect(cached?.[0]?.is_active).toBe(true);
    });
  });
});

// ─── useUpdateGeoRoutes ───────────────────────────────────────────────────────

describe("useUpdateGeoRoutes", () => {
  it("calls updateGeoRoutesInDB with correct args", async () => {
    const qc = makeQueryClient();
    mockUpdateGeoRoutesInDB.mockResolvedValue(undefined);

    const { result } = renderHook(() => useUpdateGeoRoutes(), { wrapper: makeWrapper(qc) });

    const geoRoutes = [{ country: "Vietnam", countryCode: "VN", targetUrl: "https://vn.example.com" }];

    await act(async () => {
      await result.current.mutateAsync({ linkId: "link-1", geoRoutes });
    });

    expect(mockUpdateGeoRoutesInDB).toHaveBeenCalledWith("link-1", geoRoutes);
  });

  it("invalidates links query on success", async () => {
    const qc = makeQueryClient();
    mockUpdateGeoRoutesInDB.mockResolvedValue(undefined);
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    const { result } = renderHook(() => useUpdateGeoRoutes(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      await result.current.mutateAsync({ linkId: "link-1", geoRoutes: [] });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.links });
  });
});

// ─── useDeleteLink ────────────────────────────────────────────────────────────

describe("useDeleteLink", () => {
  it("calls deleteLinkInDB with correct id", async () => {
    const qc = makeQueryClient();
    mockDeleteLinkInDB.mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeleteLink(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      await result.current.mutateAsync("link-1");
    });

    expect(mockDeleteLinkInDB).toHaveBeenCalledWith("link-1");
  });

  it("invalidates links and analytics queries on success", async () => {
    const qc = makeQueryClient();
    mockDeleteLinkInDB.mockResolvedValue(undefined);
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    const { result } = renderHook(() => useDeleteLink(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      await result.current.mutateAsync("link-1");
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.links });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.analytics.all });
  });
});
