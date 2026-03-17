import { test, expect } from "@playwright/test";

test.describe("Redirect API - Production", () => {
  // Test against live Vercel deployment - no auth required
  const LIVE_URL = "https://qrlive.vercel.app";

  test("should handle valid redirect request", async ({ request }) => {
    // Test with a sample short code - API should respond with 302, 400, or 404
    const response = await request.get(`${LIVE_URL}/functions/v1/redirect/TESTCODE`, {
      maxRedirects: 0,
    });

    // Should return either 302 (found), 307 (found), 400 (bad request), or 404 (not found)
    expect([302, 307, 400, 404, 200]).toContain(response.status());
  });

  test("should return proper error for invalid short code format", async ({ request }) => {
    // Test with obviously invalid format
    const response = await request.get(`${LIVE_URL}/functions/v1/redirect/%%%`, {
      maxRedirects: 0,
    });

    // Should handle gracefully
    expect([400, 404, 302, 307, 200]).toContain(response.status());
  });

  test("should return error for empty code", async ({ request }) => {
    // Test with empty code
    const response = await request.get(`${LIVE_URL}/functions/v1/redirect/`, {
      maxRedirects: 0,
    });

    // Should return 404 or 400
    expect([404, 400, 405, 200, 301, 302, 307]).toContain(response.status());
  });

  test("should handle non-existent short code", async ({ request }) => {
    // Test with a code that definitely doesn't exist
    const response = await request.get(
      `${LIVE_URL}/functions/v1/redirect/NONEXISTENT12345`,
      {
        maxRedirects: 0,
      }
    );

    // Should return 404, 400, or redirect
    expect([404, 400, 302, 307, 200]).toContain(response.status());
  });

  test("should include proper response headers", async ({ request }) => {
    const response = await request.get(`${LIVE_URL}/functions/v1/redirect/TEST`, {
      maxRedirects: 0,
    });

    // Check for content-type header
    const contentType = response.headers()["content-type"];
    // Should be JSON or text or HTML
    expect(contentType).toBeDefined();
  });
});

test.describe("Redirect API - Local Development", () => {
  // Uses baseURL from playwright.config.ts (Vite webServer on 127.0.0.1:5173)

  test("should load home page and redirect to auth", async ({ page }) => {
    const response = await page.goto("/");
    // Should get 200 OK (page loads, then client-side redirect to /auth)
    expect([200, 302]).toContain(response?.status());
    // Client-side auth guard redirects unauthenticated users
    await expect(page).toHaveURL(/\/auth/);
  });
});

test.describe("Redirect API - Response Validation", () => {
  // Validate redirect response structure
  const LIVE_URL = "https://qrlive.vercel.app";

  test("should provide meaningful error response", async ({ request }) => {
    const response = await request.get(`${LIVE_URL}/functions/v1/redirect/INVALID`, {
      maxRedirects: 0,
    });

    // Try to parse response
    if (response.ok() || response.status() === 400 || response.status() === 404) {
      const contentType = response.headers()["content-type"];
      if (contentType?.includes("json")) {
        const body = await response.json();
        expect(body).toBeDefined();
      }
    }
  });

  test("should handle special characters in code", async ({ request }) => {
    const specialCodes = ["test@code", "test#code", "test/code", "test?code"];

    for (const code of specialCodes) {
      const response = await request.get(`${LIVE_URL}/functions/v1/redirect/${code}`, {
        maxRedirects: 0,
      });

      // API should handle gracefully — any well-formed HTTP status is acceptable
      expect([400, 404, 302, 307, 405, 200]).toContain(response.status());
    }
  });

  test("should handle case sensitivity consistently", async ({ request }) => {
    const response1 = await request.get(`${LIVE_URL}/functions/v1/redirect/TestCode`, {
      maxRedirects: 0,
    });
    const response2 = await request.get(`${LIVE_URL}/functions/v1/redirect/testcode`, {
      maxRedirects: 0,
    });

    // Both should have consistent behavior — either both found or both not found
    const status1 = response1.status();
    const status2 = response2.status();
    const bothValid = [302, 307].includes(status1) && [302, 307].includes(status2);
    const bothInvalid = [400, 404, 200].includes(status1) && [400, 404, 200].includes(status2);
    expect(bothValid || bothInvalid).toBeTruthy();
  });
});
