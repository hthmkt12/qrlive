import { expect, test } from "@playwright/test";
import {
  createCredentials,
  getCredentialSetupHint,
  hasPresetCredentials,
  login,
  logout,
  signUp,
} from "./e2e-test-helpers";

test("redirects unauthenticated users to /auth", async ({ page }) => {
  await page.goto("/");
  await page.waitForURL("**/auth");
  await expect(page).toHaveURL(/\/auth$/);
});

test("logs in and logs out successfully", async ({ page }) => {
  test.skip(
    !hasPresetCredentials,
    getCredentialSetupHint(),
  );

  const credentials = createCredentials("auth-login");

  await page.goto("/");
  await page.waitForURL("**/auth");

  if (hasPresetCredentials) {
    await login(page, credentials);
  } else {
    await signUp(page, credentials);
    await logout(page);
    await login(page, credentials);
  }

  await expect(page).toHaveURL(/\/$/);
  await logout(page);
});

test("keeps the session after a page reload", async ({ page }) => {
  test.skip(
    !hasPresetCredentials,
    getCredentialSetupHint(),
  );

  const credentials = createCredentials("auth-session");

  if (hasPresetCredentials) {
    await login(page, credentials);
  } else {
    await signUp(page, credentials);
  }

  await page.reload();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: "Tạo QR mới" }).first()).toBeVisible();
});
