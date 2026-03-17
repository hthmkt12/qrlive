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

    const [pngDownload] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "PNG" }).click(),
    ]);
    expect(pngDownload.suggestedFilename()).toMatch(/\.png$/i);
    await expect(pngDownload.failure()).resolves.toBeNull();

    const [svgDownload] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "SVG" }).click(),
    ]);
    expect(svgDownload.suggestedFilename()).toMatch(/\.svg$/i);
    await expect(svgDownload.failure()).resolves.toBeNull();

    const unexpectedConsoleErrors = consoleErrors.filter(
      (message) => !/^Failed to load resource: the server responded with a status of 400 \(\)$/.test(message),
    );

    expect(pageErrors).toEqual([]);
    expect(unexpectedConsoleErrors).toEqual([]);
    await expect(qrSvg).toBeVisible();
    await expect(page.getByRole("button", { name: "PNG" })).toBeVisible();
    await expect(page.getByRole("button", { name: "SVG" })).toBeVisible();
  });
});
