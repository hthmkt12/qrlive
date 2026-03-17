import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockInvoke } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: mockInvoke,
    },
  },
}));

import { purgeLinkMetadataCacheQuietly } from "@/lib/link-cache-invalidation";

describe("purgeLinkMetadataCacheQuietly", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue({ error: null });
  });

  it("does nothing when shortCode is empty", async () => {
    await purgeLinkMetadataCacheQuietly();
    await purgeLinkMetadataCacheQuietly(null);
    await purgeLinkMetadataCacheQuietly("");

    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("invokes the cache invalidation function with the short code", async () => {
    await purgeLinkMetadataCacheQuietly("HOT123");

    expect(mockInvoke).toHaveBeenCalledWith("link-cache-invalidate", {
      body: { shortCode: "HOT123" },
    });
  });

  it("warns when Supabase returns an invocation error", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mockInvoke.mockResolvedValue({ error: { message: "Forbidden" } });

    await purgeLinkMetadataCacheQuietly("HOT123");

    expect(warnSpy).toHaveBeenCalledWith("Khong the xoa cache link Redis:", { message: "Forbidden" });
  });

  it("warns when the invocation throws", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = new Error("network down");
    mockInvoke.mockRejectedValue(error);

    await purgeLinkMetadataCacheQuietly("HOT123");

    expect(warnSpy).toHaveBeenCalledWith("Khong the xoa cache link Redis:", error);
  });
});
