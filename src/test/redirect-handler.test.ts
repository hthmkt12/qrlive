/**
 * Tests for the REAL redirect handler logic (not the simulator).
 * Exercises supabase/functions/redirect/redirect-handler.ts via mock adapters.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  handleRedirect,
  hashPasswordPBKDF2,
  type HandlerRequest,
  type LinkRecord,
  type SupabaseAdapter,
} from "../../supabase/functions/redirect/redirect-handler";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeAdapter(overrides: Partial<SupabaseAdapter> = {}): SupabaseAdapter {
  return {
    fetchLink: vi.fn().mockResolvedValue(null),
    recentClickCount: vi.fn().mockResolvedValue(0),
    insertClick: vi.fn().mockResolvedValue(undefined),
    updateLink: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeReq(overrides: Partial<HandlerRequest> = {}): HandlerRequest {
  return {
    method: "GET",
    url: "https://edge.example.com/redirect/ABC123",
    headers: { "user-agent": "Mozilla/5.0", "x-forwarded-for": "1.2.3.4" },
    ...overrides,
  };
}

function activeLink(overrides: Partial<LinkRecord> = {}): LinkRecord {
  return {
    id: "link-1",
    default_url: "https://example.com",
    geo_routes: [],
    ...overrides,
  };
}

/** Generate a legacy SHA-256 hash for testing */
async function legacySha256(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(salt + password);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("redirect-handler (real logic)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // 1. OPTIONS preflight
  it("returns 200 with CORS headers for OPTIONS preflight", async () => {
    const adapter = makeAdapter();
    const res = await handleRedirect(makeReq({ method: "OPTIONS" }), adapter);
    expect(res.status).toBe(200);
    expect(res.headers["Access-Control-Allow-Origin"]).toBe("*");
  });

  // 2. Invalid short code → 400
  it("returns 400 JSON for invalid short code", async () => {
    const adapter = makeAdapter();
    const res = await handleRedirect(
      makeReq({ url: "https://edge.example.com/redirect/ab" }), // too short
      adapter,
    );
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toBe("Invalid short code");
  });

  // 3. Missing/inactive link → 404
  it("returns 404 JSON for missing or inactive link", async () => {
    const adapter = makeAdapter({ fetchLink: vi.fn().mockResolvedValue(null) });
    const res = await handleRedirect(makeReq(), adapter);
    expect(res.status).toBe(404);
    expect(JSON.parse(res.body).error).toBe("Link not found or inactive");
  });

  // 4. Expired link → 410 HTML
  it("returns 410 HTML for expired link", async () => {
    const adapter = makeAdapter({
      fetchLink: vi.fn().mockResolvedValue(
        activeLink({ expires_at: "2020-01-01T00:00:00Z" }),
      ),
    });
    const res = await handleRedirect(makeReq(), adapter);
    expect(res.status).toBe(410);
    expect(res.headers["Content-Type"]).toContain("text/html");
    expect(res.body).toContain("Link này đã hết hạn");
  });

  // 5. Password-protected GET → 200 HTML form
  it("returns 200 HTML password form on GET for protected link", async () => {
    const hash = await hashPasswordPBKDF2("secret123");
    const adapter = makeAdapter({
      fetchLink: vi.fn().mockResolvedValue(activeLink({ password_hash: hash })),
    });
    const res = await handleRedirect(makeReq(), adapter);
    expect(res.status).toBe(200);
    expect(res.headers["Content-Type"]).toContain("text/html");
    expect(res.body).toContain("Link được bảo vệ");
    expect(res.body).toContain("Mật khẩu");
  });

  // 6. Password-protected POST wrong password → 401 HTML
  it("returns 401 HTML for wrong password", async () => {
    const hash = await hashPasswordPBKDF2("secret123");
    const adapter = makeAdapter({
      fetchLink: vi.fn().mockResolvedValue(activeLink({ password_hash: hash })),
    });
    const res = await handleRedirect(
      makeReq({ method: "POST", formData: { password: "wrongpass" } }),
      adapter,
    );
    expect(res.status).toBe(401);
    expect(res.body).toContain("Mật khẩu không đúng");
  });

  // 7. Password-protected POST correct password → 302 redirect
  it("returns 302 redirect for correct password", async () => {
    const hash = await hashPasswordPBKDF2("secret123");
    const adapter = makeAdapter({
      fetchLink: vi.fn().mockResolvedValue(activeLink({ password_hash: hash })),
    });
    const res = await handleRedirect(
      makeReq({ method: "POST", formData: { password: "secret123" } }),
      adapter,
    );
    expect(res.status).toBe(302);
    expect(res.headers["Location"]).toBe("https://example.com");
  });

  // 8. Legacy SHA-256 opportunistic rehash
  it("triggers updateLink for legacy SHA-256 hash after successful verify", async () => {
    const salt = "test-salt";
    const legacyHash = await legacySha256("mypass", salt);
    const updateLink = vi.fn().mockResolvedValue(undefined);
    const adapter = makeAdapter({
      fetchLink: vi.fn().mockResolvedValue(
        activeLink({ password_hash: legacyHash, password_salt: salt }),
      ),
      updateLink,
    });
    const res = await handleRedirect(
      makeReq({ method: "POST", formData: { password: "mypass" } }),
      adapter,
    );
    expect(res.status).toBe(302);
    // updateLink should have been called with a PBKDF2 hash
    expect(updateLink).toHaveBeenCalledOnce();
    const [id, fields] = updateLink.mock.calls[0];
    expect(id).toBe("link-1");
    expect((fields as Record<string, unknown>).password_hash).toMatch(/^pbkdf2:/);
    expect((fields as Record<string, unknown>).password_salt).toBeNull();
  });

  // 9. Geo-routing priority: bypass_url → target_url → default_url
  it("resolves geo-routing with bypass_url priority", async () => {
    const adapter = makeAdapter({
      fetchLink: vi.fn().mockResolvedValue(
        activeLink({
          default_url: "https://default.com",
          geo_routes: [
            { country_code: "VN", target_url: "https://vn.com", bypass_url: "https://bypass-vn.com" },
            { country_code: "US", target_url: "https://us.com" },
          ],
        }),
      ),
    });

    // VN → bypass_url
    const res1 = await handleRedirect(
      makeReq({ headers: { "user-agent": "Mozilla", "cf-ipcountry": "VN", "x-forwarded-for": "1.2.3.4" } }),
      adapter,
    );
    expect(res1.status).toBe(302);
    expect(res1.headers["Location"]).toBe("https://bypass-vn.com");

    // US → target_url (no bypass)
    const res2 = await handleRedirect(
      makeReq({ headers: { "user-agent": "Mozilla", "cf-ipcountry": "US", "x-forwarded-for": "1.2.3.5" } }),
      adapter,
    );
    expect(res2.status).toBe(302);
    expect(res2.headers["Location"]).toBe("https://us.com");

    // JP → default_url (no matching route)
    const res3 = await handleRedirect(
      makeReq({ headers: { "user-agent": "Mozilla", "cf-ipcountry": "JP", "x-forwarded-for": "1.2.3.6" } }),
      adapter,
    );
    expect(res3.status).toBe(302);
    expect(res3.headers["Location"]).toBe("https://default.com");
  });

  // 10. Bot traffic skips insert; non-bot records click
  it("skips click insert for bot user-agent", async () => {
    const insertClick = vi.fn();
    const adapter = makeAdapter({
      fetchLink: vi.fn().mockResolvedValue(activeLink()),
      insertClick,
    });
    await handleRedirect(
      makeReq({ headers: { "user-agent": "Googlebot/2.1", "x-forwarded-for": "1.2.3.4" } }),
      adapter,
    );
    expect(insertClick).not.toHaveBeenCalled();
  });

  it("records click for non-bot user-agent", async () => {
    const insertClick = vi.fn();
    const adapter = makeAdapter({
      fetchLink: vi.fn().mockResolvedValue(activeLink()),
      recentClickCount: vi.fn().mockResolvedValue(0),
      insertClick,
    });
    await handleRedirect(
      makeReq({ headers: { "user-agent": "Mozilla/5.0", "x-forwarded-for": "1.2.3.4" } }),
      adapter,
    );
    expect(insertClick).toHaveBeenCalledOnce();
  });

  // 11. Duplicate click within 60s skips insert
  it("skips click insert when recent click exists within 60s", async () => {
    const insertClick = vi.fn();
    const adapter = makeAdapter({
      fetchLink: vi.fn().mockResolvedValue(activeLink()),
      recentClickCount: vi.fn().mockResolvedValue(1), // already clicked
      insertClick,
    });
    await handleRedirect(makeReq(), adapter);
    expect(insertClick).not.toHaveBeenCalled();
  });

  // 12. Invalid redirect target → 400 JSON
  it("returns 400 JSON for invalid redirect target (non-http URL)", async () => {
    const adapter = makeAdapter({
      fetchLink: vi.fn().mockResolvedValue(
        activeLink({ default_url: "javascript:alert(1)" }),
      ),
    });
    const res = await handleRedirect(makeReq(), adapter);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toBe("Invalid redirect target");
  });
});
