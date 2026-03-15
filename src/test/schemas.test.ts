import { describe, it, expect } from "vitest";
import { authSchema, linkFormSchema, geoRouteSchema } from "@/lib/schemas";

// ─── authSchema ──────────────────────────────────────────────────────────────

describe("authSchema", () => {
  it("accepts valid email + password", () => {
    const result = authSchema.safeParse({ email: "user@example.com", password: "password123" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = authSchema.safeParse({ email: "not-an-email", password: "password123" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Email không hợp lệ");
  });

  it("rejects password shorter than 8 chars", () => {
    const result = authSchema.safeParse({ email: "user@example.com", password: "abc" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Mật khẩu tối thiểu 8 ký tự");
  });

  it("rejects missing fields", () => {
    const result = authSchema.safeParse({});
    expect(result.success).toBe(false);
    expect(result.error?.issues.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── geoRouteSchema ───────────────────────────────────────────────────────────

describe("geoRouteSchema", () => {
  const valid = {
    country: "Vietnam",
    countryCode: "VN",
    targetUrl: "https://example.com/vn",
  };

  it("accepts valid geo route without bypassUrl", () => {
    expect(geoRouteSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts valid geo route with bypassUrl", () => {
    const result = geoRouteSchema.safeParse({
      ...valid,
      bypassUrl: "https://bypass.example.com",
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty string bypassUrl (treated as no bypass)", () => {
    const result = geoRouteSchema.safeParse({ ...valid, bypassUrl: "" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid targetUrl", () => {
    const result = geoRouteSchema.safeParse({ ...valid, targetUrl: "not-a-url" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("URL không hợp lệ");
  });

  it("rejects invalid bypassUrl", () => {
    const result = geoRouteSchema.safeParse({ ...valid, bypassUrl: "bad-url" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Bypass URL không hợp lệ");
  });

  it("rejects missing countryCode", () => {
    const result = geoRouteSchema.safeParse({ ...valid, countryCode: "" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Chọn quốc gia");
  });
});

// ─── linkFormSchema ───────────────────────────────────────────────────────────

describe("linkFormSchema", () => {
  const valid = {
    name: "My QR Link",
    defaultUrl: "https://example.com",
    geoRoutes: [],
  };

  it("accepts valid link with no geo routes", () => {
    expect(linkFormSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts valid link with geo routes", () => {
    const result = linkFormSchema.safeParse({
      ...valid,
      geoRoutes: [{ country: "US", countryCode: "US", targetUrl: "https://us.example.com" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = linkFormSchema.safeParse({ ...valid, name: "" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Tên không được để trống");
  });

  it("rejects name over 100 chars", () => {
    const result = linkFormSchema.safeParse({ ...valid, name: "x".repeat(101) });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Tên quá dài");
  });

  it("rejects invalid defaultUrl", () => {
    const result = linkFormSchema.safeParse({ ...valid, defaultUrl: "not-a-url" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("URL mặc định không hợp lệ");
  });

  it("defaults geoRoutes to empty array when omitted", () => {
    const result = linkFormSchema.safeParse({ name: "Test", defaultUrl: "https://example.com" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.geoRoutes).toEqual([]);
    }
  });

  it("propagates geo route validation errors", () => {
    const result = linkFormSchema.safeParse({
      ...valid,
      geoRoutes: [{ country: "US", countryCode: "US", targetUrl: "bad-url" }],
    });
    expect(result.success).toBe(false);
  });
});
