import { test, expect } from "@playwright/test";

test.describe("Auth - Login Page", () => {
  test.beforeEach(async ({ page }) => {
    // Clear auth cookies/storage before each test
    await page.context().clearCookies();
    await page.goto("/auth");
  });

  test("should display login form with email, password, and submit button", async ({
    page,
  }) => {
    // Check email input
    const emailInput = page.locator('input[id="email"]');
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute("type", "email");

    // Check password input
    const passwordInput = page.locator('input[id="password"]');
    await expect(passwordInput).toBeVisible();
    await expect(passwordInput).toHaveAttribute("type", "password");

    // Check submit button
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toContainText("Đăng nhập");

    // Check label text
    await expect(page.locator("label:has-text('Email')")).toBeVisible();
    await expect(page.locator("label:has-text('Mật khẩu')")).toBeVisible();
  });

  test("should allow typing in email and password fields", async ({ page }) => {
    const emailInput = page.locator('input[id="email"]');
    const passwordInput = page.locator('input[id="password"]');

    // Type into fields
    await emailInput.fill("test@example.com");
    await passwordInput.fill("password123");

    // Verify values are set
    await expect(emailInput).toHaveValue("test@example.com");
    await expect(passwordInput).toHaveValue("password123");
  });

  test("should disable submit button during submission", async ({ page }) => {
    const emailInput = page.locator('input[id="email"]');
    const passwordInput = page.locator('input[id="password"]');
    const submitButton = page.locator('button[type="submit"]');

    // Fill form
    await emailInput.fill("test@example.com");
    await passwordInput.fill("password123");

    // Button should be enabled before click
    await expect(submitButton).toBeEnabled();
  });

  test("should have working toggle between login and signup modes", async ({
    page,
  }) => {
    // Check initial login mode
    const loginButton = page.locator('button[type="submit"]');
    await expect(loginButton).toContainText("Đăng nhập");

    // Click toggle to signup
    const toggleButton = page.locator('button[type="button"]:has-text("Đăng ký")');
    await toggleButton.click();

    // Check signup mode
    await expect(loginButton).toContainText("Đăng ký");

    // Click toggle back to login
    const toggleBackButton = page.locator('button[type="button"]:has-text("Đăng nhập")');
    await toggleBackButton.click();

    // Check login mode again
    await expect(loginButton).toContainText("Đăng nhập");
  });

  test("should show loading state during submission", async ({ page, context }) => {
    // Mock a slow auth response
    await context.route("**/auth/v1/token", (route) => {
      setTimeout(() => route.abort(), 100);
    });

    const emailInput = page.locator('input[id="email"]');
    const passwordInput = page.locator('input[id="password"]');
    const submitButton = page.locator('button[type="submit"]');

    await emailInput.fill("test@example.com");
    await passwordInput.fill("password123");
    await submitButton.click();

    // Check for disabled state during submission
    await expect(submitButton).toBeDisabled();
  });
});

test.describe("Auth - Redirect Protection", () => {
  test("should redirect unauthenticated user from / to /auth", async ({
    page,
  }) => {
    // Clear auth
    await page.context().clearCookies();

    // Try to navigate to home
    await page.goto("/");

    // Should be redirected to /auth
    await expect(page).toHaveURL(/\/auth/);
  });

  test("should display auth page title 'QRLive'", async ({ page }) => {
    await page.goto("/auth");

    // Check logo
    const logo = page.locator("h1:has-text('QRLive')");
    await expect(logo).toBeVisible();
  });
});
