import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock password-utils before importing mutations
vi.mock("@/lib/password-utils", () => ({
  hashPassword: vi.fn().mockResolvedValue("pbkdf2:sha256:600000:bW9jay1zYWx0:bW9jay1oYXNo"),
}));

vi.mock("@/lib/link-cache-invalidation", () => ({
  purgeLinkMetadataCacheQuietly: vi.fn().mockResolvedValue(undefined),
}));

// Mock Supabase client
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: { getSession: vi.fn(), onAuthStateChange: vi.fn() },
  },
}));

import { supabase } from "@/integrations/supabase/client";
import { purgeLinkMetadataCacheQuietly } from "@/lib/link-cache-invalidation";
import { hashPassword } from "@/lib/password-utils";
import {
  generateShortCode,
  createLinkInDB,
  updateLinkInDB,
  updateGeoRoutesInDB,
  deleteLinkInDB,
} from "@/lib/db/mutations";

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── generateShortCode ──────────────────────────────────────────────────────

describe("generateShortCode", () => {
  it("returns a 6-char uppercase alphanumeric code on no collision", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    vi.mocked(supabase.from).mockReturnValue({ select } as never);

    const code = await generateShortCode();
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
    expect(supabase.from).toHaveBeenCalledWith("qr_links");
  });

  it("retries on collision and succeeds on second attempt", async () => {
    const maybeSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: { id: "existing" } }) // collision
      .mockResolvedValueOnce({ data: null }); // no collision
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    vi.mocked(supabase.from).mockReturnValue({ select } as never);

    const code = await generateShortCode();
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
    expect(maybeSingle).toHaveBeenCalledTimes(2);
  });

  it("throws after 5 collision attempts", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: "existing" } });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    vi.mocked(supabase.from).mockReturnValue({ select } as never);

    await expect(generateShortCode()).rejects.toThrow(
      "Failed to generate unique short code after 5 attempts"
    );
    expect(maybeSingle).toHaveBeenCalledTimes(5);
  });
});

// ─── createLinkInDB ─────────────────────────────────────────────────────────

describe("createLinkInDB", () => {
  function mockInsertChain(linkData: Record<string, unknown> | null, error: unknown = null) {
    const single = vi.fn().mockResolvedValue({ data: linkData, error });
    const selectAfterInsert = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select: selectAfterInsert });
    return insert;
  }

  function mockGenerateShortCode() {
    // Mock the collision check for auto-generated codes
    const maybeSingle = vi.fn().mockResolvedValue({ data: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    return { select, eq, maybeSingle };
  }

  it("creates link with auto-generated short code", async () => {
    const { select: collisionSelect } = mockGenerateShortCode();
    const insert = mockInsertChain({ id: "link-1", name: "Test", short_code: "ABC123" });

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === "qr_links") {
        // First call: collision check (select), second call: insert
        const callCount = vi.mocked(supabase.from).mock.calls.filter((c) => c[0] === "qr_links").length;
        if (callCount <= 1) return { select: collisionSelect } as never;
        return { insert } as never;
      }
      return {} as never;
    });

    const result = await createLinkInDB("Test Link", "https://example.com", [], "user-1");
    expect(result).toBeDefined();
    expect(result.id).toBe("link-1");
  });

  it("rejects invalid custom short code format", async () => {
    await expect(
      createLinkInDB("Test", "https://example.com", [], "user-1", "ab") // too short
    ).rejects.toThrow("INVALID_SHORT_CODE_FORMAT");
  });

  it("rejects custom code with invalid characters", async () => {
    await expect(
      createLinkInDB("Test", "https://example.com", [], "user-1", "test@code")
    ).rejects.toThrow("INVALID_SHORT_CODE_FORMAT");
  });

  it("normalizes custom short code to uppercase", async () => {
    // Mock uniqueness check to find the code is taken
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: "existing" } });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    vi.mocked(supabase.from).mockReturnValue({ select } as never);

    await expect(
      createLinkInDB("Test", "https://example.com", [], "user-1", "my-code")
    ).rejects.toThrow("SHORT_CODE_TAKEN");

    // Verify it checked with uppercase
    expect(eq).toHaveBeenCalledWith("short_code", "MY-CODE");
  });

  it("throws SHORT_CODE_TAKEN when custom code already exists", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: "existing" } });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    vi.mocked(supabase.from).mockReturnValue({ select } as never);

    await expect(
      createLinkInDB("Test", "https://example.com", [], "user-1", "TAKEN")
    ).rejects.toThrow("SHORT_CODE_TAKEN");
  });

  it("maps Postgres 23505 error to SHORT_CODE_TAKEN", async () => {
    const { select: collisionSelect } = mockGenerateShortCode();
    const single = vi.fn().mockResolvedValue({ data: null, error: { code: "23505", message: "unique_violation" } });
    const selectAfterInsert = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select: selectAfterInsert });

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === "qr_links") {
        const callCount = vi.mocked(supabase.from).mock.calls.filter((c) => c[0] === "qr_links").length;
        if (callCount <= 1) return { select: collisionSelect } as never;
        return { insert } as never;
      }
      return {} as never;
    });

    await expect(
      createLinkInDB("Test", "https://example.com", [], "user-1")
    ).rejects.toThrow("SHORT_CODE_TAKEN");
  });

  it("hashes password when provided", async () => {
    const { select: collisionSelect } = mockGenerateShortCode();
    const single = vi.fn().mockResolvedValue({
      data: { id: "link-1", name: "Test" },
      error: null,
    });
    const selectAfterInsert = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select: selectAfterInsert });

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === "qr_links") {
        const callCount = vi.mocked(supabase.from).mock.calls.filter((c) => c[0] === "qr_links").length;
        if (callCount <= 1) return { select: collisionSelect } as never;
        return { insert } as never;
      }
      return {} as never;
    });

    await createLinkInDB("Test", "https://example.com", [], "user-1", undefined, undefined, "secret");

    expect(hashPassword).toHaveBeenCalledWith("secret");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        password_hash: "pbkdf2:sha256:600000:bW9jay1zYWx0:bW9jay1oYXNo",
        password_salt: null,
      })
    );
  });

  it("stores null password fields when no password provided", async () => {
    const { select: collisionSelect } = mockGenerateShortCode();
    const single = vi.fn().mockResolvedValue({
      data: { id: "link-1", name: "Test" },
      error: null,
    });
    const selectAfterInsert = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select: selectAfterInsert });

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === "qr_links") {
        const callCount = vi.mocked(supabase.from).mock.calls.filter((c) => c[0] === "qr_links").length;
        if (callCount <= 1) return { select: collisionSelect } as never;
        return { insert } as never;
      }
      return {} as never;
    });

    await createLinkInDB("Test", "https://example.com", [], "user-1");

    expect(hashPassword).not.toHaveBeenCalled();
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        password_hash: null,
        password_salt: null,
        webhook_url: null,
      })
    );
  });

  it("stores webhook_url when provided", async () => {
    const { select: collisionSelect } = mockGenerateShortCode();
    const single = vi.fn().mockResolvedValue({
      data: { id: "link-1", name: "Test", webhook_url: "https://hooks.example.com/qrlive" },
      error: null,
    });
    const selectAfterInsert = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select: selectAfterInsert });

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === "qr_links") {
        const callCount = vi.mocked(supabase.from).mock.calls.filter((c) => c[0] === "qr_links").length;
        if (callCount <= 1) return { select: collisionSelect } as never;
        return { insert } as never;
      }
      return {} as never;
    });

    await createLinkInDB(
      "Test",
      "https://example.com",
      [],
      "user-1",
      undefined,
      undefined,
      undefined,
      undefined,
      "https://hooks.example.com/qrlive"
    );

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ webhook_url: "https://hooks.example.com/qrlive" })
    );
  });

  it("inserts geo routes after creating link", async () => {
    const { select: collisionSelect } = mockGenerateShortCode();
    const single = vi.fn().mockResolvedValue({
      data: { id: "link-1", name: "Test" },
      error: null,
    });
    const selectAfterInsert = vi.fn().mockReturnValue({ single });
    const insertLink = vi.fn().mockReturnValue({ select: selectAfterInsert });
    const insertRoutes = vi.fn().mockResolvedValue({ error: null });

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === "qr_links") {
        const callCount = vi.mocked(supabase.from).mock.calls.filter((c) => c[0] === "qr_links").length;
        if (callCount <= 1) return { select: collisionSelect } as never;
        return { insert: insertLink } as never;
      }
      if (table === "geo_routes") return { insert: insertRoutes } as never;
      return {} as never;
    });

    await createLinkInDB("Test", "https://example.com", [
      { country: "Vietnam", countryCode: "VN", targetUrl: "https://vn.example.com" },
    ], "user-1");

    expect(insertRoutes).toHaveBeenCalledWith([
      expect.objectContaining({
        link_id: "link-1",
        country: "Vietnam",
        country_code: "VN",
        target_url: "https://vn.example.com",
        bypass_url: null,
      }),
    ]);
  });

  it("filters out incomplete geo routes", async () => {
    const { select: collisionSelect } = mockGenerateShortCode();
    const single = vi.fn().mockResolvedValue({
      data: { id: "link-1", name: "Test" },
      error: null,
    });
    const selectAfterInsert = vi.fn().mockReturnValue({ single });
    const insertLink = vi.fn().mockReturnValue({ select: selectAfterInsert });

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === "qr_links") {
        const callCount = vi.mocked(supabase.from).mock.calls.filter((c) => c[0] === "qr_links").length;
        if (callCount <= 1) return { select: collisionSelect } as never;
        return { insert: insertLink } as never;
      }
      return {} as never;
    });

    // Route with missing targetUrl should be filtered out
    await createLinkInDB("Test", "https://example.com", [
      { country: "Vietnam", countryCode: "VN", targetUrl: "" },
    ], "user-1");

    // geo_routes table should not be called since the only route was filtered out
    const geoRouteCalls = vi.mocked(supabase.from).mock.calls.filter((c) => c[0] === "geo_routes");
    expect(geoRouteCalls).toHaveLength(0);
  });
});

// ─── updateLinkInDB ─────────────────────────────────────────────────────────

describe("updateLinkInDB", () => {
  function mockUpdateChain(shortCode = "ABC123", error: unknown = null) {
    const single = vi.fn().mockResolvedValue({ data: { short_code: shortCode }, error });
    const select = vi.fn().mockReturnValue({ single });
    const eq = vi.fn().mockReturnValue({ select });
    const update = vi.fn().mockReturnValue({ eq });
    return { update, eq, select, single };
  }

  it("updates basic fields without password change", async () => {
    const { update, eq, select } = mockUpdateChain();
    vi.mocked(supabase.from).mockReturnValue({ update } as never);

    await updateLinkInDB("link-1", { name: "Updated" });

    expect(update).toHaveBeenCalledWith({ name: "Updated" });
    expect(eq).toHaveBeenCalledWith("id", "link-1");
    expect(select).toHaveBeenCalledWith("short_code");
    expect(purgeLinkMetadataCacheQuietly).toHaveBeenCalledWith("ABC123");
    expect(hashPassword).not.toHaveBeenCalled();
  });

  it("clears password when empty string provided", async () => {
    const { update } = mockUpdateChain();
    vi.mocked(supabase.from).mockReturnValue({ update } as never);

    await updateLinkInDB("link-1", { name: "Test" }, "");

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        password_hash: null,
        password_salt: null,
      })
    );
  });

  it("sets new password hash when password provided", async () => {
    const { update } = mockUpdateChain();
    vi.mocked(supabase.from).mockReturnValue({ update } as never);

    await updateLinkInDB("link-1", { name: "Test" }, "new-password");

    expect(hashPassword).toHaveBeenCalledWith("new-password");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        password_hash: "pbkdf2:sha256:600000:bW9jay1zYWx0:bW9jay1oYXNo",
        password_salt: null,
      })
    );
  });

  it("updates webhook_url when provided in link updates", async () => {
    const { update } = mockUpdateChain("HOOK99");
    vi.mocked(supabase.from).mockReturnValue({ update } as never);

    await updateLinkInDB("link-1", { webhook_url: "https://hooks.example.com/qrlive" });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ webhook_url: "https://hooks.example.com/qrlive" })
    );
    expect(purgeLinkMetadataCacheQuietly).toHaveBeenCalledWith("HOOK99");
  });

  it("throws on supabase error", async () => {
    const { update } = mockUpdateChain("ABC123", { message: "DB error" });
    vi.mocked(supabase.from).mockReturnValue({ update } as never);

    await expect(updateLinkInDB("link-1", { name: "Test" })).rejects.toEqual({ message: "DB error" });
  });
});

// ─── updateGeoRoutesInDB ────────────────────────────────────────────────────

describe("updateGeoRoutesInDB", () => {
  it("calls upsert_geo_routes RPC with mapped params", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { short_code: "ABC123" }, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    vi.mocked(supabase.from).mockReturnValue({ select } as never);
    vi.mocked(supabase.rpc).mockResolvedValue({ error: null } as never);

    await updateGeoRoutesInDB("link-1", [
      { country: "Vietnam", countryCode: "VN", targetUrl: "https://vn.example.com", bypassUrl: "https://bypass.com" },
    ]);

    expect(supabase.rpc).toHaveBeenCalledWith("upsert_geo_routes", {
      p_link_id: "link-1",
      p_routes: [
        {
          country: "Vietnam",
          country_code: "VN",
          target_url: "https://vn.example.com",
          bypass_url: "https://bypass.com",
        },
      ],
    });
    expect(purgeLinkMetadataCacheQuietly).toHaveBeenCalledWith("ABC123");
  });

  it("sets bypass_url to empty string when not provided", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { short_code: "US1234" }, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    vi.mocked(supabase.from).mockReturnValue({ select } as never);
    vi.mocked(supabase.rpc).mockResolvedValue({ error: null } as never);

    await updateGeoRoutesInDB("link-1", [
      { country: "US", countryCode: "US", targetUrl: "https://us.example.com" },
    ]);

    expect(supabase.rpc).toHaveBeenCalledWith("upsert_geo_routes", {
      p_link_id: "link-1",
      p_routes: [expect.objectContaining({ bypass_url: "" })],
    });
  });

  it("throws on RPC error", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { short_code: "ERR123" }, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    vi.mocked(supabase.from).mockReturnValue({ select } as never);
    vi.mocked(supabase.rpc).mockResolvedValue({ error: { message: "RPC failed" } } as never);

    await expect(
      updateGeoRoutesInDB("link-1", [])
    ).rejects.toEqual({ message: "RPC failed" });
  });
});

// ─── deleteLinkInDB ─────────────────────────────────────────────────────────

describe("deleteLinkInDB", () => {
  it("deletes link by id", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { short_code: "DEL123" }, error: null });
    const eqSelect = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq: eqSelect });
    const eqDelete = vi.fn().mockResolvedValue({ error: null });
    const deleteFn = vi.fn().mockReturnValue({ eq: eqDelete });

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === "qr_links") {
        const callCount = vi.mocked(supabase.from).mock.calls.filter((call) => call[0] === "qr_links").length;
        return callCount === 1 ? ({ select } as never) : ({ delete: deleteFn } as never);
      }
      return {} as never;
    });

    await deleteLinkInDB("link-1");

    expect(supabase.from).toHaveBeenCalledWith("qr_links");
    expect(deleteFn).toHaveBeenCalled();
    expect(eqDelete).toHaveBeenCalledWith("id", "link-1");
    expect(purgeLinkMetadataCacheQuietly).toHaveBeenCalledWith("DEL123");
  });

  it("throws on supabase error", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { short_code: "DEL123" }, error: null });
    const eqSelect = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq: eqSelect });
    const eqDelete = vi.fn().mockResolvedValue({ error: { message: "Delete failed" } });
    const deleteFn = vi.fn().mockReturnValue({ eq: eqDelete });

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === "qr_links") {
        const callCount = vi.mocked(supabase.from).mock.calls.filter((call) => call[0] === "qr_links").length;
        return callCount === 1 ? ({ select } as never) : ({ delete: deleteFn } as never);
      }
      return {} as never;
    });

    await expect(deleteLinkInDB("link-1")).rejects.toEqual({ message: "Delete failed" });
  });
});
