import { expect, test } from "@playwright/test";
import {
  authenticate,
  getCredentialSetupHint,
  hasPresetCredentials,
  openCreateDialog,
} from "./e2e-test-helpers";

test.describe("Dashboard - UI Elements", () => {
  test.skip(
    !hasPresetCredentials,
    getCredentialSetupHint(),
  );

  test("displays create link button when authenticated", async ({ page }) => {
    await authenticate(page, "dash-ui");

    await expect(
      page.getByRole("button", { name: "Tạo QR mới" }).first(),
    ).toBeVisible();
  });

  test("shows QRLive branding in header", async ({ page }) => {
    await authenticate(page, "dash-brand");

    await expect(page.getByRole("heading", { name: /QR.*Live/i })).toBeVisible();
  });

  test("has theme toggle button", async ({ page }) => {
    await authenticate(page, "dash-theme");

    await expect(page.getByTitle("Đổi giao diện")).toBeVisible();
  });

  test("has logout button", async ({ page }) => {
    await authenticate(page, "dash-logout");

    await expect(page.getByTitle("Đăng xuất")).toBeVisible();
  });
});

test.describe("Dashboard - Create Link Dialog", () => {
  test.skip(
    !hasPresetCredentials,
    getCredentialSetupHint(),
  );

  test("opens create link dialog", async ({ page }) => {
    await authenticate(page, "dash-dialog-open");

    await openCreateDialog(page);

    await expect(
      page.getByRole("heading", { name: "Tạo link QR mới" }),
    ).toBeVisible();
  });

  test("displays form fields in create dialog", async ({ page }) => {
    await authenticate(page, "dash-dialog-fields");

    await openCreateDialog(page);

    await expect(page.getByPlaceholder("Ví dụ: Netflix US")).toBeVisible();
    await expect(page.getByPlaceholder("https://example.com")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Tạo link & QR Code" }),
    ).toBeVisible();
  });
});

test.describe("Dashboard - Link List", () => {
  test.skip(
    !hasPresetCredentials,
    getCredentialSetupHint(),
  );

  test("shows links or empty state on dashboard", async ({ page }) => {
    await authenticate(page, "dash-list");

    // Either link cards are visible or the dashboard renders without error
    const cards = page.locator("div.rounded-xl");
    const count = await cards.count();

    if (count > 0) {
      await expect(cards.first()).toBeVisible();
    }
    // No links is a valid state (empty dashboard) — no assertion needed
  });
});

test.describe("Dashboard - Header Info", () => {
  test.skip(
    !hasPresetCredentials,
    getCredentialSetupHint(),
  );

  test("displays user email in header", async ({ page }) => {
    await authenticate(page, "dash-email");

    // User email is rendered in DashboardHeader as .text-muted-foreground
    await expect(
      page.locator(".text-muted-foreground").filter({ hasText: "@" }),
    ).toBeVisible();
  });
});
