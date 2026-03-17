import fs from "node:fs";
import path from "node:path";
import { expect, Page } from "@playwright/test";

export interface TestCredentials {
  email: string;
  password: string;
}

function readDotEnvLocal(): Record<string, string> {
  const envPath = path.resolve(process.cwd(), ".env.local");

  if (!fs.existsSync(envPath)) {
    return {};
  }

  return fs
    .readFileSync(envPath, "utf-8")
    .split(/\r?\n/)
    .reduce<Record<string, string>>((acc, line) => {
      if (!line || line.trim().startsWith("#")) {
        return acc;
      }

      const separatorIndex = line.indexOf("=");
      if (separatorIndex === -1) {
        return acc;
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();

      if (key) {
        acc[key] = value;
      }

      return acc;
    }, {});
}

const dotEnvLocal = readDotEnvLocal();
const presetEmail = process.env.E2E_TEST_EMAIL ?? dotEnvLocal.E2E_TEST_EMAIL;
const presetPassword =
  process.env.E2E_TEST_PASSWORD ?? dotEnvLocal.E2E_TEST_PASSWORD;
const recommendedSeedEmail = "qrlive.e2e@example.com";

export const hasPresetCredentials = Boolean(presetEmail && presetPassword);

const DEFAULT_PASSWORD = process.env.E2E_TEST_PASSWORD ?? "Playwright!234";

function uniqueSuffix(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createCredentials(prefix: string): TestCredentials {
  if (hasPresetCredentials) {
    return {
      email: presetEmail!,
      password: presetPassword!,
    };
  }

  return {
    email: `${uniqueSuffix(prefix)}@example.com`,
    password: DEFAULT_PASSWORD,
  };
}

export function getCredentialSetupHint(): string {
  return `Set E2E_TEST_EMAIL=${recommendedSeedEmail} and E2E_TEST_PASSWORD in .env.local or the shell environment.`;
}

export function createUniqueName(prefix: string): string {
  return uniqueSuffix(prefix);
}

async function fillAuthForm(page: Page, credentials: TestCredentials) {
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Mật khẩu").fill(credentials.password);
}

async function waitForDashboard(page: Page) {
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: "Tạo QR mới" }).first()).toBeVisible();
}

export async function signUp(page: Page, credentials: TestCredentials) {
  await page.goto("/");
  await page.waitForURL("**/auth");
  await page.getByRole("button", { name: "Đăng ký", exact: true }).click();
  await fillAuthForm(page, credentials);
  await page.getByRole("button", { name: "Đăng ký", exact: true }).click();
  await waitForDashboard(page);
}

export async function login(page: Page, credentials: TestCredentials) {
  await page.goto("/auth");
  await fillAuthForm(page, credentials);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await waitForDashboard(page);
}

export async function authenticate(page: Page, prefix: string): Promise<TestCredentials> {
  const credentials = createCredentials(prefix);

  if (hasPresetCredentials) {
    await login(page, credentials);
  } else {
    await signUp(page, credentials);
  }

  return credentials;
}

export async function logout(page: Page) {
  await page.getByTitle("Đăng xuất").click();
  await expect(page).toHaveURL(/\/auth$/);
}

export async function openCreateDialog(page: Page) {
  await page.getByRole("button", { name: "Tạo QR mới" }).first().click();
  await expect(page.getByRole("heading", { name: "Tạo link QR mới" })).toBeVisible();
}

export async function createLink(page: Page, name: string, url: string) {
  await openCreateDialog(page);
  await page.getByPlaceholder("Ví dụ: Netflix US").fill(name);
  await page.getByPlaceholder("https://example.com").fill(url);
  await page.getByRole("button", { name: "Tạo link & QR Code" }).click();
  await expect(getLinkCard(page, name)).toBeVisible();
}

export function getLinkCard(page: Page, name: string) {
  return page
    .locator("div.rounded-xl", {
      has: page.getByRole("heading", { name, exact: true }),
    })
    .first();
}

export async function openEditDialog(page: Page, name: string) {
  await getLinkCard(page, name).getByRole("button", { name: "Chỉnh sửa" }).click();
  await expect(page.getByRole("heading", { name: "Chỉnh sửa link" })).toBeVisible();
}

export async function openStatsPanel(page: Page, name: string) {
  await getLinkCard(page, name).getByRole("button", { name: "Thống kê" }).click();
  await expect(page.getByRole("button", { name: "Quay lại" })).toBeVisible();
}

export async function seedAnalyticsFromLinkCard(
  page: Page,
  name: string,
  countryCode = "VN",
) {
  const wrapperUrl = (await getLinkCard(page, name)
    .locator("p.font-mono.text-xs.text-primary")
    .first()
    .textContent())?.trim();

  if (!wrapperUrl) {
    throw new Error(`Missing redirect URL for link: ${name}`);
  }

  const response = await page.request.get(wrapperUrl, {
    failOnStatusCode: false,
    maxRedirects: 0,
    headers: {
      "cf-ipcountry": countryCode,
      referer: "https://playwright.dev/",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
    },
  });

  expect(response.status()).toBeGreaterThanOrEqual(300);
  expect(response.status()).toBeLessThan(400);
  await page.waitForTimeout(1_500);
}
