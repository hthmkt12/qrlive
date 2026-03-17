import { expect, test } from "@playwright/test";
import {
  authenticate,
  createLink,
  createUniqueName,
  getCredentialSetupHint,
  hasPresetCredentials,
} from "./e2e-test-helpers";

test.describe("Bulk operations", () => {
  test.skip(
    !hasPresetCredentials,
    getCredentialSetupHint(),
  );

  test("exports links to CSV when links exist", async ({ page }) => {
    await authenticate(page, "bulk-export");
    const name = createUniqueName("bulk-export");

    await createLink(page, name, "https://example.com/bulk-export");

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Xuất CSV" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/qrlive-links-.*\.csv$/);
  });

  test("opens the CSV import dialog", async ({ page }) => {
    await authenticate(page, "bulk-dialog");

    await page.getByRole("button", { name: "Nhập CSV" }).click();
    await expect(page.getByRole("heading", { name: "Nhập link từ CSV" })).toBeVisible();
  });

  test("shows a preview table for a valid CSV file", async ({ page }) => {
    await authenticate(page, "bulk-valid");
    const dialogTitle = page.getByRole("heading", { name: "Nhập link từ CSV" });
    const csv = [
      "name,default_url,custom_short_code,expires_at,geo_country_code,geo_target_url,geo_bypass_url",
      "Bulk Valid,https://example.com/bulk-valid,BULKVALID,,,,",
    ].join("\n");

    await page.getByRole("button", { name: "Nhập CSV" }).click();
    await expect(dialogTitle).toBeVisible();
    await page
      .getByRole("dialog")
      .locator('input[type="file"]')
      .setInputFiles({
        name: "valid-links.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(csv, "utf-8"),
      });

    await expect(page.getByText("Bulk Valid")).toBeVisible();
    await expect(page.getByText("1 hợp lệ")).toBeVisible();
  });

  test("shows validation errors for an invalid CSV file", async ({ page }) => {
    await authenticate(page, "bulk-invalid");
    const csv = [
      "name,default_url,custom_short_code,expires_at,geo_country_code,geo_target_url,geo_bypass_url",
      ",not-a-url,BAD,,,,",
    ].join("\n");

    await page.getByRole("button", { name: "Nhập CSV" }).click();
    await page
      .getByRole("dialog")
      .locator('input[type="file"]')
      .setInputFiles({
        name: "invalid-links.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(csv, "utf-8"),
      });

    await expect(page.getByText("Tên không được để trống")).toBeVisible();
    await expect(page.getByText("URL không hợp lệ")).toBeVisible();
  });
});
