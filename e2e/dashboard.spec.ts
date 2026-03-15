import { test, expect } from "@playwright/test";

test.describe("Dashboard - UI Elements", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to home - will redirect to /auth if not authenticated
    await page.goto("/");
  });

  test.skip("should display dashboard with create link button when authenticated", async ({
    page,
  }) => {
    // This test requires valid TEST_EMAIL and TEST_PASSWORD env vars
    // For now, skipping until auth setup is available

    // Check if we're on dashboard (not auth page)
    await expect(page).not.toHaveURL(/\/auth/);

    // Check for "Tạo Link" button in header
    const createButton = page.locator('button:has-text("Tạo Link")');
    await expect(createButton).toBeVisible();
  });

  test.skip("should have QRLive branding visible", async ({ page }) => {
    // Check logo is visible on authenticated page
    const logo = page.locator("h1:has-text('QRLive')");
    await expect(logo).toBeVisible();
  });

  test.skip("should have theme toggle button", async ({ page }) => {
    // Check for theme toggle (Sun/Moon icon button)
    const themeButton = page.locator('button[title="Đổi giao diện"]');
    await expect(themeButton).toBeVisible();
  });

  test.skip("should have logout button", async ({ page }) => {
    // Check for logout button
    const logoutButton = page.locator('button[title="Đăng xuất"]');
    await expect(logoutButton).toBeVisible();
  });
});

test.describe("Dashboard - Create Link Dialog", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test.skip("should open create link dialog when clicking create button", async ({
    page,
  }) => {
    // Click the create link button
    const createButton = page.locator('button:has-text("Tạo Link")');
    await createButton.click();

    // Check for dialog title
    const dialogTitle = page.locator("[role='dialog'] h2");
    await expect(dialogTitle).toBeVisible();
  });

  test.skip("should display form fields in create dialog", async ({ page }) => {
    // Open dialog
    const createButton = page.locator('button:has-text("Tạo Link")');
    await createButton.click();

    // Check for form inputs
    const urlInput = page.locator('input[type="text"]').first();
    await expect(urlInput).toBeVisible();

    // Check for submit button
    const submitButton = page.locator('[role="dialog"] button[type="submit"]');
    await expect(submitButton).toBeVisible();
  });
});

test.describe("Dashboard - Link List", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test.skip("should display link cards on dashboard", async ({ page }) => {
    // Check for link card container
    const linkCards = page.locator("[data-testid='link-card']");
    const count = await linkCards.count();

    // Should have at least some links or empty state message
    if (count === 0) {
      const emptyState = page.locator("text=/không có|empty/i");
      await expect(emptyState).toBeVisible();
    } else {
      await expect(linkCards.first()).toBeVisible();
    }
  });

  test.skip("should show link information on cards", async ({ page }) => {
    // Get first link card
    const firstCard = page.locator("[data-testid='link-card']").first();

    if (await firstCard.isVisible()) {
      // Check for required fields
      const shortCode = firstCard.locator("[data-testid='short-code']");
      const targetUrl = firstCard.locator("[data-testid='target-url']");

      await expect(shortCode).toBeVisible();
      await expect(targetUrl).toBeVisible();
    }
  });
});

test.describe("Dashboard - Analytics", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test.skip("should display total clicks counter", async ({ page }) => {
    // Check for total clicks display
    const clicksCounter = page.locator("text=/tổng click|total clicks/i");
    await expect(clicksCounter).toBeVisible();
  });

  test.skip("should display user email in header", async ({ page }) => {
    // Check for user email display
    const userEmail = page.locator(".text-muted-foreground:has-text('@')");
    await expect(userEmail).toBeVisible();
  });
});
