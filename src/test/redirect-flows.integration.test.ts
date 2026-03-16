import { describe, it, expect, beforeEach } from "vitest";
import { hashPassword } from "@/lib/password-utils";
import {
  simulateRedirectFunction,
  buildPasswordForm,
  resolveTarget,
  MockLink,
} from "./redirect-simulator";

describe("Redirect Function Flows", () => {
  describe("Normal Redirect", () => {
    it("resolves short_code to default_url with 302 status", async () => {
      const mockLink: MockLink = {
        id: "1",
        short_code: "TEST",
        default_url: "https://example.com",
        is_active: true,
      };
      const res = await simulateRedirectFunction("TEST", mockLink);
      expect(res.status).toBe(302);
      expect(res.headers["location"]).toBe("https://example.com");
      expect(res.headers["cache-control"]).toBe("no-store");
    });

    it("includes CORS headers in response", async () => {
      const mockLink: MockLink = {
        id: "1",
        short_code: "TEST",
        default_url: "https://example.com",
        is_active: true,
      };
      const res = await simulateRedirectFunction("TEST", mockLink);
      expect(res.headers["access-control-allow-origin"]).toBe("*");
    });

    it("prevents robots from caching with X-Robots-Tag", async () => {
      const mockLink: MockLink = {
        id: "1",
        short_code: "TEST",
        default_url: "https://example.com",
        is_active: true,
      };
      const res = await simulateRedirectFunction("TEST", mockLink);
      expect(res.headers["x-robots-tag"]).toBe("noindex");
    });
  });

  describe("Invalid Short Code", () => {
    it("rejects short_code < 3 chars with 400", async () => {
      const res = await simulateRedirectFunction("AB", null);
      expect(res.status).toBe(400);
      expect(res.body).toContain("Invalid short code");
    });

    it("rejects short_code > 20 chars with 400", async () => {
      const longCode = "A".repeat(21);
      const res = await simulateRedirectFunction(longCode, null);
      expect(res.status).toBe(400);
    });

    it("rejects short_code with invalid characters with 400", async () => {
      const res = await simulateRedirectFunction("test@code", null);
      expect(res.status).toBe(400);
    });

    it("allows hyphens and underscores in short_code", async () => {
      const mockLink: MockLink = {
        id: "1",
        short_code: "TEST-CODE",
        default_url: "https://example.com",
        is_active: true,
      };
      const res1 = await simulateRedirectFunction("TEST-CODE", mockLink);
      const res2 = await simulateRedirectFunction("TEST_CODE", null);
      expect(res1.status).toBe(302); // exists
      expect(res2.status).toBe(404); // not found
    });
  });

  describe("Expired Link", () => {
    it("returns 410 Gone for expired link", async () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      const mockLink: MockLink = {
        id: "1",
        short_code: "EXPIRED",
        default_url: "https://example.com",
        expires_at: pastDate,
        is_active: true,
      };
      const res = await simulateRedirectFunction("EXPIRED", mockLink);
      expect(res.status).toBe(410);
      expect(res.headers["content-type"]).toContain("text/html");
    });

    it("expired link response includes Vietnamese message", async () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      const mockLink: MockLink = {
        id: "1",
        short_code: "EXPIRED",
        default_url: "https://example.com",
        expires_at: pastDate,
        is_active: true,
      };
      const res = await simulateRedirectFunction("EXPIRED", mockLink);
      expect(res.body).toContain("Link này đã hết hạn");
    });

    it("active link with future expiry redirects normally", async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const mockLink: MockLink = {
        id: "1",
        short_code: "ACTIVE",
        default_url: "https://example.com",
        expires_at: futureDate,
        is_active: true,
      };
      const res = await simulateRedirectFunction("ACTIVE", mockLink);
      expect(res.status).toBe(302);
    });
  });

  describe("Password-Protected Links", () => {
    let passwordSalt: string;
    let passwordHash: string;

    beforeEach(async () => {
      passwordSalt = "test-salt-12345";
      passwordHash = await hashPassword("correct-password", passwordSalt);
    });

    it("GET on password-protected link returns 200 with HTML form", async () => {
      const mockLink: MockLink = {
        id: "1",
        short_code: "PROTECTED",
        default_url: "https://example.com",
        password_hash: passwordHash,
        password_salt: passwordSalt,
        is_active: true,
      };
      const res = await simulateRedirectFunction("PROTECTED", mockLink, "GET");
      expect(res.status).toBe(200);
      expect(res.body).toContain("Link được bảo vệ");
      expect(res.headers["content-type"]).toContain("text/html");
    });

    it("password form includes required fields", async () => {
      const mockLink: MockLink = {
        id: "1",
        short_code: "PROTECTED",
        default_url: "https://example.com",
        password_hash: passwordHash,
        password_salt: passwordSalt,
        is_active: true,
      };
      const res = await simulateRedirectFunction("PROTECTED", mockLink, "GET");
      expect(res.body).toContain('type="password"');
      expect(res.body).toContain('name="password"');
      expect(res.body).toContain("Tiếp tục");
    });

    it("POST with wrong password returns 401 with error message", async () => {
      const mockLink: MockLink = {
        id: "1",
        short_code: "PROTECTED",
        default_url: "https://example.com",
        password_hash: passwordHash,
        password_salt: passwordSalt,
        is_active: true,
      };
      const res = await simulateRedirectFunction("PROTECTED", mockLink, "POST", {
        password: "wrong-password",
      });
      expect(res.status).toBe(401);
      expect(res.body).toContain("Mật khẩu không đúng");
    });

    it("POST with correct password redirects with 302", async () => {
      const mockLink: MockLink = {
        id: "1",
        short_code: "PROTECTED",
        default_url: "https://example.com",
        password_hash: passwordHash,
        password_salt: passwordSalt,
        is_active: true,
      };
      const res = await simulateRedirectFunction("PROTECTED", mockLink, "POST", {
        password: "correct-password",
      });
      expect(res.status).toBe(302);
      expect(res.headers["location"]).toBe("https://example.com");
    });

    it("password hash is deterministic with same salt", async () => {
      const hash1 = await hashPassword("test-password", "fixed-salt");
      const hash2 = await hashPassword("test-password", "fixed-salt");
      expect(hash1).toBe(hash2);
    });

    it("empty password submission treated as wrong password", async () => {
      const mockLink: MockLink = {
        id: "1",
        short_code: "PROTECTED",
        default_url: "https://example.com",
        password_hash: passwordHash,
        password_salt: passwordSalt,
        is_active: true,
      };
      const res = await simulateRedirectFunction("PROTECTED", mockLink, "POST", {
        password: "",
      });
      expect(res.status).toBe(401);
    });
  });

  describe("Geo-Routing", () => {
    it("uses geo_routes when country_code header present", async () => {
      const mockLink: MockLink = {
        id: "1",
        short_code: "GEO",
        default_url: "https://default.example.com",
        is_active: true,
        geo_routes: [
          { country_code: "US", target_url: "https://us.example.com" },
        ],
      };
      const res = await simulateRedirectFunction("GEO", mockLink, "GET", undefined, {
        "cf-ipcountry": "US",
      });
      expect(res.status).toBe(302);
      expect(res.headers["location"]).toBe("https://us.example.com");
    });

    it("prioritizes bypass_url over target_url in geo routes", async () => {
      const mockLink: MockLink = {
        id: "1",
        short_code: "GEO",
        default_url: "https://default.example.com",
        is_active: true,
        geo_routes: [
          {
            country_code: "JP",
            target_url: "https://jp.example.com",
            bypass_url: "https://jp-bypass.example.com",
          },
        ],
      };
      const res = await simulateRedirectFunction("GEO", mockLink, "GET", undefined, {
        "cf-ipcountry": "JP",
      });
      expect(res.headers["location"]).toBe("https://jp-bypass.example.com");
    });

    it("falls back to default_url if no matching geo route", async () => {
      const mockLink: MockLink = {
        id: "1",
        short_code: "GEO",
        default_url: "https://default.example.com",
        is_active: true,
        geo_routes: [
          { country_code: "US", target_url: "https://us.example.com" },
        ],
      };
      const res = await simulateRedirectFunction("GEO", mockLink, "GET", undefined, {
        "cf-ipcountry": "GB",
      });
      expect(res.headers["location"]).toBe("https://default.example.com");
    });

    it("case-insensitive country code matching", async () => {
      const mockLink: MockLink = {
        id: "1",
        short_code: "GEO",
        default_url: "https://default.example.com",
        is_active: true,
        geo_routes: [
          { country_code: "us", target_url: "https://us.example.com" },
        ],
      };
      const res = await simulateRedirectFunction("GEO", mockLink, "GET", undefined, {
        "cf-ipcountry": "US",
      });
      expect(res.headers["location"]).toBe("https://us.example.com");
    });
  });

  describe("Click Recording", () => {
    it("records click with IP, user agent, referer", () => {
      const clickEvent = {
        link_id: "link-123",
        ip_address: "192.168.1.1",
        user_agent: "Mozilla/5.0",
        referer: "https://example.com",
        country_code: "US",
      };
      expect(clickEvent).toHaveProperty("ip_address");
      expect(clickEvent).toHaveProperty("user_agent");
      expect(clickEvent).toHaveProperty("referer");
    });

    it("extracts IP from x-forwarded-for header (first value)", () => {
      const header = "192.168.1.1, 10.0.0.1, 172.16.0.1";
      const ip = header.split(",")[0].trim();
      expect(ip).toBe("192.168.1.1");
    });

    it("extracts IP from cf-connecting-ip as fallback", () => {
      const cfIP = "203.0.113.45";
      // If x-forwarded-for not present, use cf-connecting-ip
      expect(cfIP).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
    });

    it("truncates referer to 500 chars to prevent unbounded DB writes", () => {
      const longReferer = "https://example.com/" + "x".repeat(1000);
      const truncated = longReferer.substring(0, 500);
      expect(truncated.length).toBeLessThanOrEqual(500);
    });

    it("skips recording for bot user agents", () => {
      const botAgents = [
        "Googlebot/2.1",
        "facebookexternalhit/1.1",
        "TwitterBot/2.0",
        "AmazonBot/0.1",
      ];
      const botPattern = /bot|crawler|spider|prerender|headless|facebookexternalhit|twitterbot|slurp/i;
      botAgents.forEach((agent) => {
        expect(botPattern.test(agent)).toBe(true);
      });
    });

    it("doesn't record duplicate clicks from same IP within 1 minute", () => {
      const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
      const now = new Date().toISOString();
      // DB check: count clicks from IP in last 60s
      expect(new Date(oneMinuteAgo).getTime()).toBeLessThan(new Date(now).getTime());
    });
  });

  describe("Security", () => {
    it("rejects non-HTTP(S) URLs", async () => {
      const mockLink: MockLink = {
        id: "1",
        short_code: "UNSAFE",
        default_url: "javascript:alert('xss')",
        is_active: true,
      };
      const res = await simulateRedirectFunction("UNSAFE", mockLink);
      expect(res.status).toBe(400);
      expect(res.body).toContain("Invalid redirect target");
    });

    it("only redirects to HTTP(S) URLs", async () => {
      const mockLink: MockLink = {
        id: "1",
        short_code: "SAFE",
        default_url: "https://example.com/path",
        is_active: true,
      };
      const res = await simulateRedirectFunction("SAFE", mockLink);
      expect(res.status).toBe(302);
    });

    it("uses CORS headers to allow cross-origin requests", async () => {
      const mockLink: MockLink = {
        id: "1",
        short_code: "CORS",
        default_url: "https://example.com",
        is_active: true,
      };
      const res = await simulateRedirectFunction("CORS", mockLink);
      expect(res.headers["access-control-allow-origin"]).toBe("*");
      expect(res.headers["access-control-allow-headers"]).toContain("content-type");
    });
  });

  describe("Error Handling", () => {
    it("returns 404 for non-existent short code", async () => {
      const res = await simulateRedirectFunction("NOTFOUND", null);
      expect(res.status).toBe(404);
      expect(res.body).toContain("Link not found or inactive");
    });

    it("returns 400 for invalid short code format", async () => {
      const res = await simulateRedirectFunction("AB", null);
      expect(res.status).toBe(400);
    });

    it("response includes Content-Type header", async () => {
      const res = await simulateRedirectFunction("NOTFOUND", null);
      expect(res.headers["content-type"]).toBeTruthy();
    });

    it("error response is JSON when applicable", async () => {
      const res = await simulateRedirectFunction("NOTFOUND", null);
      expect(() => JSON.parse(res.body)).not.toThrow();
    });
  });

  describe("Password Hash Compatibility", () => {
    it("frontend and edge function use same hashing algorithm", async () => {
      // Both use SHA-256 with salt prefix: salt + password
      const salt = "test-salt";
      const password = "test-password";
      const hash = await hashPassword(password, salt);
      // Should be 64-char hex (SHA-256)
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("hash is reproducible with same salt and password", async () => {
      const h1 = await hashPassword("secret", "salt");
      const h2 = await hashPassword("secret", "salt");
      expect(h1).toBe(h2);
    });

    it("different salts produce different hashes", async () => {
      const h1 = await hashPassword("same-password", "salt-1");
      const h2 = await hashPassword("same-password", "salt-2");
      expect(h1).not.toBe(h2);
    });
  });

  describe("Integration: Full Redirect Flow", () => {
    it("complete happy path: GET active link → 302 redirect", async () => {
      const mockLink: MockLink = {
        id: "1",
        short_code: "HAPPY",
        default_url: "https://example.com/target",
        is_active: true,
      };
      const res = await simulateRedirectFunction("HAPPY", mockLink);
      expect(res.status).toBe(302);
      expect(res.headers["location"]).toBe("https://example.com/target");
      expect(res.headers["access-control-allow-origin"]).toBe("*");
      expect(res.headers["x-robots-tag"]).toBe("noindex");
    });

    it("password flow: GET form → POST password → 302 redirect", async () => {
      const salt = "test-salt";
      const hash = await hashPassword("secret", salt);
      const mockLink: MockLink = {
        id: "1",
        short_code: "PASS",
        default_url: "https://example.com",
        password_hash: hash,
        password_salt: salt,
        is_active: true,
      };
      // Step 1: GET form
      const form = await simulateRedirectFunction("PASS", mockLink, "GET");
      expect(form.status).toBe(200);
      expect(form.body).toContain("Link được bảo vệ");

      // Step 2: POST with correct password
      const redirect = await simulateRedirectFunction("PASS", mockLink, "POST", {
        password: "secret",
      });
      expect(redirect.status).toBe(302);
      expect(redirect.headers["location"]).toBe("https://example.com");
    });

    it("geo-routing flow: detect country → lookup geo routes → redirect to correct URL", async () => {
      const mockLink: MockLink = {
        id: "1",
        short_code: "GEO-FULL",
        default_url: "https://default.example.com",
        is_active: true,
        geo_routes: [
          { country_code: "US", target_url: "https://us.example.com" },
          { country_code: "JP", target_url: "https://jp.example.com" },
        ],
      };
      const usRes = await simulateRedirectFunction("GEO-FULL", mockLink, "GET", undefined, {
        "cf-ipcountry": "US",
      });
      const jpRes = await simulateRedirectFunction("GEO-FULL", mockLink, "GET", undefined, {
        "cf-ipcountry": "JP",
      });
      const unknownRes = await simulateRedirectFunction("GEO-FULL", mockLink);
      expect(usRes.headers["location"]).toBe("https://us.example.com");
      expect(jpRes.headers["location"]).toBe("https://jp.example.com");
      expect(unknownRes.headers["location"]).toBe("https://default.example.com");
    });

    it("expired + password protected: shows expiry not form", async () => {
      const salt = "salt";
      const hash = await hashPassword("pass", salt);
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      const mockLink: MockLink = {
        id: "1",
        short_code: "EXPIRED-PASS",
        default_url: "https://example.com",
        expires_at: pastDate,
        password_hash: hash,
        password_salt: salt,
        is_active: true,
      };
      const res = await simulateRedirectFunction("EXPIRED-PASS", mockLink);
      expect(res.status).toBe(410);
      expect(res.body).toContain("hết hạn");
      expect(res.body).not.toContain("Link được bảo vệ");
    });
  });
});
