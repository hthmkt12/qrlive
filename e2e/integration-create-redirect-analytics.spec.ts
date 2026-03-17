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

/**
 * Integration test: create link → real redirect → verify analytics data.
 *
 * Asserts concrete analytics outcomes (click counts, redirect Location,
 * referer breakdown) rather than just checking the panel renders.
 */
test.describe("Integration: create → redirect → analytics", () => {
  test.skip(!hasPresetCredentials, getCredentialSetupHint());

  test("seeded redirect produces verifiable analytics data", async ({ page }) => {
    // 1. Authenticate
    await authenticate(page, "integration");
    const name = createUniqueName("integ");
    const targetUrl = "https://example.com/integration-target";

    // 2. Create a unique link
    await createLink(page, name, targetUrl);

    // 3. Trigger a real redirect with explicit headers
    const redirectResponse = await seedAnalyticsFromLinkCard(page, name, "VN");

    // 4. Assert redirect Location equals the expected target URL
    const location = redirectResponse.headers()["location"];
    expect(location).toBe(targetUrl);

    // 5. Open the stats panel for the created link
    await openStatsPanel(page, name);

    // 6. Wait for analytics data to load (poll for non-zero total)
    const totalClicksEl = page
      .locator("div.rounded-xl", { has: page.getByText("Tổng clicks") })
      .locator("p.text-2xl.font-bold");

    await expect(totalClicksEl).not.toHaveText("...", { timeout: 10_000 });
    await expect(totalClicksEl).not.toHaveText("0", { timeout: 10_000 });

    // 7. Assert total clicks ≥ 1
    const totalText = await totalClicksEl.textContent();
    const totalClicks = Number(totalText?.trim());
    expect(totalClicks).toBeGreaterThanOrEqual(1);

    // 8. Assert today clicks ≥ 1
    const todayClicksEl = page
      .locator("div.rounded-xl", { has: page.getByText("Hôm nay") })
      .locator("p.text-2xl.font-bold");
    await expect(todayClicksEl).not.toHaveText("...", { timeout: 5_000 });
    const todayText = await todayClicksEl.textContent();
    expect(Number(todayText?.trim())).toBeGreaterThanOrEqual(1);

    // 9. Assert referer section shows https://playwright.dev/
    const refererSection = page.locator("div.rounded-xl", {
      has: page.getByText("Nguồn truy cập"),
    });
    const refererEntry = refererSection.locator("span.font-mono", {
      hasText: "https://playwright.dev/",
    });
    await expect(refererEntry).toBeVisible({ timeout: 5_000 });

    // 10. Assert click count alongside the referer row is ≥ 1
    const refererRow = refererEntry.locator("xpath=ancestor::div[contains(@class,'flex')]");
    const refererCount = refererRow.locator("span.text-muted-foreground");
    const countText = await refererCount.textContent();
    expect(Number(countText?.trim())).toBeGreaterThanOrEqual(1);
  });
});
