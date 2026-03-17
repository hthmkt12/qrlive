import { defineConfig } from "@playwright/test";

const DEPLOYED_URL = "https://qrlive.vercel.app";
const isDeployedScript = process.env.npm_lifecycle_event === "test:e2e:deployed";
const baseURL = process.env.E2E_BASE_URL || (isDeployedScript ? DEPLOYED_URL : "http://127.0.0.1:5173");
const isLocal = /localhost|127\.0\.0\.1/.test(baseURL);

export default defineConfig({
  testDir: "./e2e",
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  fullyParallel: false,
  timeout: 90_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
    browserName: "chromium",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
      },
    },
  ],
  // Only boot the local dev server when targeting localhost
  ...(isLocal
    ? {
        webServer: {
          command: "npm run dev -- --host 127.0.0.1 --port 5173 --strictPort",
          url: "http://127.0.0.1:5173",
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }
    : {}),
});
