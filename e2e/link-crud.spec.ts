import { expect, test } from "@playwright/test";
import {
  authenticate,
  createLink,
  createUniqueName,
  getCredentialSetupHint,
  getLinkCard,
  hasPresetCredentials,
  openEditDialog,
} from "./e2e-test-helpers";

test.describe("Link CRUD", () => {
  test.skip(
    !hasPresetCredentials,
    getCredentialSetupHint(),
  );

  test("creates a link from the dashboard", async ({ page }) => {
    await authenticate(page, "crud-create");
    const name = createUniqueName("crud-create");

    await createLink(page, name, "https://example.com/create");

    await expect(getLinkCard(page, name)).toBeVisible();
  });

  test("edits an existing link", async ({ page }) => {
    await authenticate(page, "crud-edit");
    const name = createUniqueName("crud-edit");
    const updatedName = `${name}-updated`;

    await createLink(page, name, "https://example.com/edit");
    await openEditDialog(page, name);

    const dialog = page.getByRole("dialog");
    await dialog.locator("input").first().fill(updatedName);
    await dialog.getByRole("button", { name: /Lưu thay đổi/i }).click();

    await expect(getLinkCard(page, updatedName)).toBeVisible();
    await expect(page.getByRole("heading", { name, exact: true })).toHaveCount(0);
  });

  test("toggles a link active state", async ({ page }) => {
    await authenticate(page, "crud-toggle");
    const name = createUniqueName("crud-toggle");

    await createLink(page, name, "https://example.com/toggle");

    const card = getLinkCard(page, name);
    await card.getByRole("button", { name: /Tạm dừng link/i }).click({ force: true });
    await expect(card.getByRole("button", { name: /Kích hoạt link/i })).toBeVisible();
  });

  test("deletes a link after confirmation", async ({ page }) => {
    await authenticate(page, "crud-delete");
    const name = createUniqueName("crud-delete");

    await createLink(page, name, "https://example.com/delete");

    const card = getLinkCard(page, name);
    await card.getByRole("button", { name: /Xóa link/i }).click({ force: true });
    await page.getByRole("button", { name: /Xóa/i, exact: true }).click();

    await expect(card).toHaveCount(0);
  });
});
