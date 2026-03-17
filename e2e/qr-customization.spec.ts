import { expect, test } from "@playwright/test";
import {
  authenticate,
  createLink,
  createUniqueName,
  getCredentialSetupHint,
  hasPresetCredentials,
  openStatsPanel,
} from "./e2e-test-helpers";

test.describe("QR customization", () => {
  test.skip(
    !hasPresetCredentials,
    getCredentialSetupHint(),
  );

  test("updates QR colors and keeps PNG/SVG actions usable", async ({ page }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];

    page.on("pageerror", (error) => {
      pageErrors.push(String(error));
    });
    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });

    await authenticate(page, "qr-custom");
    const name = createUniqueName("qr-custom");

    await createLink(page, name, "https://example.com/qr-custom");
    await openStatsPanel(page, name);

    const qrSvg = page.getByTestId("qr-preview").locator("svg");
    await expect(qrSvg).toBeVisible();

    const initialMarkup = await qrSvg.evaluate((node) => node.outerHTML.toLowerCase());
    expect(initialMarkup).toContain("#14d4c0");

    await page.getByRole("button", { name: /Trắng/i }).click();

    await expect
      .poll(async () => qrSvg.evaluate((node) => node.outerHTML.toLowerCase()))
      .toContain("#ffffff");

    await page.getByRole("button", { name: "PNG" }).click();
    await page.waitForTimeout(250);
    await page.getByRole("button", { name: "SVG" }).click();
    await page.waitForTimeout(250);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
    await expect(qrSvg).toBeVisible();
    await expect(page.getByRole("button", { name: "PNG" })).toBeVisible();
    await expect(page.getByRole("button", { name: "SVG" })).toBeVisible();
  });
});
