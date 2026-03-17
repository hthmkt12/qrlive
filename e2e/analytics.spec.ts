import { expect, test } from "@playwright/test";
import {
  authenticate,
  createLink,
  createUniqueName,
  getCredentialSetupHint,
  hasPresetCredentials,
  openStatsPanel,
  seedAnalyticsFromLinkCard,
} from "./e2e-test-helpers";

test.describe("Analytics", () => {
  test.skip(
    !hasPresetCredentials,
    getCredentialSetupHint(),
  );

  test("opens analytics, changes filters, exports CSV, and returns to dashboard", async ({
    page,
  }) => {
    await authenticate(page, "analytics");
    const name = createUniqueName("analytics");

    await createLink(page, name, "https://example.com/analytics");
    await seedAnalyticsFromLinkCard(page, name, "VN");
    await openStatsPanel(page, name);

    await expect(page.getByText("Tổng clicks")).toBeVisible();
    await expect(page.getByText("Clicks 7 ngày qua")).toBeVisible();

    await page.getByRole("button", { name: /30 ngày/i }).click();
    await expect(page.getByText("Clicks 30 ngày qua")).toBeVisible();

    const countryFilter = page.getByRole("combobox", {
      name: /Lọc nguồn truy cập theo quốc gia/i,
    });
    await countryFilter.click();
    await expect(page.getByRole("option", { name: /Mọi nguồn truy cập/i })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: /Xuất dữ liệu/i }).click();
    const csvDownload = page.waitForEvent("download");
    await page.getByRole("menuitem", { name: /Tải xuống CSV/i }).click();
    const csvFile = await csvDownload;
    expect(csvFile.suggestedFilename()).toMatch(/analytics-.*\.csv$/);

    await page.getByRole("button", { name: /Quay lại/i }).click();
    await expect(page.getByRole("button", { name: /Tạo QR mới/i }).first()).toBeVisible();
  });
});
