import { describe, expect, it } from "vitest";
import { generateAnalyticsCSV, sanitizeCSVValue } from "@/lib/analytics-export-utils";
import { generateLinksCSV } from "@/lib/bulk-operations-utils";
import { LinkAnalyticsDetailRow, QRLinkRow } from "@/lib/db";

const analytics: LinkAnalyticsDetailRow = {
  link_id: "link-1",
  total_clicks: 2,
  today_clicks: 1,
  countries_count: 1,
  clicks_by_day: [{ date: "2026-03-16", clicks: 2 }],
  country_breakdown: [{ country_code: "VN", clicks: 2 }],
  referer_breakdown: [{ referer: "=CMD()", clicks: 2 }],
};

describe("CSV export sanitization", () => {
  it("prefixes dangerous spreadsheet formulas", () => {
    expect(sanitizeCSVValue("=SUM(A1:A2)")).toBe("'=SUM(A1:A2)");
    expect(sanitizeCSVValue("+payload")).toBe("'+payload");
    expect(sanitizeCSVValue("safe")).toBe("safe");
  });

  it("sanitizes analytics export metadata and referers", () => {
    const csv = generateAnalyticsCSV(analytics, "@Campaign");
    expect(csv).toContain("# Analytics export for: '@Campaign");
    expect(csv).toContain("'=CMD(),2");
  });

  it("keeps safe CSV values unchanged", () => {
    expect(sanitizeCSVValue("Netflix Campaign")).toBe("Netflix Campaign");
  });

  it("sanitizes bulk link names before writing CSV", () => {
    const links: QRLinkRow[] = [{
      id: "link-1",
      user_id: "user-1",
      name: "=IMPORTXML(\"http://evil\")",
      short_code: "SAFE12",
      default_url: "https://example.com",
      is_active: true,
      created_at: "2026-03-16T00:00:00Z",
      expires_at: null,
      geo_routes: [],
      has_password: false,
    }];

    expect(generateLinksCSV(links)).toContain("\"'=IMPORTXML(\"\"http://evil\"\")\"");
  });
});
