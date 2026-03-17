import { describe, expect, it } from "vitest";
import { authSchema, geoRouteSchema, linkFormSchema } from "@/lib/schemas";

describe("authSchema", () => {
  it("accepts valid email + password", () => {
    expect(authSchema.safeParse({ email: "user@example.com", password: "password123" }).success).toBe(true);
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
});

describe("geoRouteSchema", () => {
  const valid = {
    country: "Vietnam",
    countryCode: "VN",
    targetUrl: "https://example.com/vn",
  };

  it("accepts valid geo route without bypassUrl", () => {
    expect(geoRouteSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts empty string bypassUrl", () => {
    expect(geoRouteSchema.safeParse({ ...valid, bypassUrl: "" }).success).toBe(true);
  });

  it("rejects invalid targetUrl", () => {
    const result = geoRouteSchema.safeParse({ ...valid, targetUrl: "not-a-url" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("URL không hợp lệ");
  });
});

describe("linkFormSchema", () => {
  const valid = {
    name: "My QR Link",
    defaultUrl: "https://example.com",
    geoRoutes: [],
  };

  it("accepts valid link with no geo routes", () => {
    expect(linkFormSchema.safeParse(valid).success).toBe(true);
  });

  it("defaults geoRoutes to empty array when omitted", () => {
    const result = linkFormSchema.safeParse({ name: "Test", defaultUrl: "https://example.com" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.geoRoutes).toEqual([]);
  });

  it("rejects invalid defaultUrl", () => {
    const result = linkFormSchema.safeParse({ ...valid, defaultUrl: "not-a-url" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("URL mặc định không hợp lệ");
  });

  it("accepts valid webhook URL", () => {
    expect(linkFormSchema.safeParse({ ...valid, webhookUrl: "https://hooks.example.com/qrlive" }).success).toBe(true);
  });

  it("rejects webhook URLs without http or https", () => {
    const result = linkFormSchema.safeParse({ ...valid, webhookUrl: "ftp://hooks.example.com/qrlive" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Webhook URL phải bắt đầu bằng http:// hoặc https://");
  });
});
