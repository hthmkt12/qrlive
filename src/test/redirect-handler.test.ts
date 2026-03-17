import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  handleRedirect,
  hashPasswordPBKDF2,
  type HandlerRequest,
  type LinkRecord,
  type SupabaseAdapter,
} from "../../supabase/functions/redirect/redirect-handler";

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
    name: "Test Link",
    short_code: "ABC123",
    default_url: "https://example.com",
    webhook_url: null,
    webhook_secret: null,
    geo_routes: [],
    ...overrides,
  };
}

async function legacySha256(password: string, salt: string) {
  const data = new TextEncoder().encode(salt + password);
  const buffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

describe("redirect-handler (real logic)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with CORS headers for OPTIONS preflight", async () => {
    const res = await handleRedirect(makeReq({ method: "OPTIONS" }), makeAdapter());
    expect(res.status).toBe(200);
    expect(res.headers["Access-Control-Allow-Origin"]).toBe("*");
  });

  it("returns 400 JSON for invalid short code", async () => {
    const res = await handleRedirect(makeReq({ url: "https://edge.example.com/redirect/ab" }), makeAdapter());
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toBe("Invalid short code");
  });

  it("returns 404 JSON for missing or inactive link", async () => {
    const res = await handleRedirect(makeReq(), makeAdapter({ fetchLink: vi.fn().mockResolvedValue(null) }));
    expect(res.status).toBe(404);
    expect(JSON.parse(res.body).error).toBe("Link not found or inactive");
  });

  it("returns 410 HTML for expired link", async () => {
    const res = await handleRedirect(
      makeReq(),
      makeAdapter({ fetchLink: vi.fn().mockResolvedValue(activeLink({ expires_at: "2020-01-01T00:00:00Z" })) })
    );
    expect(res.status).toBe(410);
    expect(res.headers["Content-Type"]).toContain("text/html");
    expect(res.body).toContain("Link này đã hết hạn");
  });

  it("returns 200 HTML password form on GET for protected link", async () => {
    const hash = await hashPasswordPBKDF2("secret123");
    const res = await handleRedirect(
      makeReq(),
      makeAdapter({ fetchLink: vi.fn().mockResolvedValue(activeLink({ password_hash: hash })) })
    );
    expect(res.status).toBe(200);
    expect(res.headers["Content-Type"]).toContain("text/html");
    expect(res.body).toContain("Link được bảo vệ");
  });

  it("returns 401 HTML for wrong password", async () => {
    const hash = await hashPasswordPBKDF2("secret123");
    const res = await handleRedirect(
      makeReq({ method: "POST", formData: { password: "wrongpass" } }),
      makeAdapter({ fetchLink: vi.fn().mockResolvedValue(activeLink({ password_hash: hash })) })
    );
    expect(res.status).toBe(401);
    expect(res.body).toContain("Mật khẩu không đúng");
  });

  it("returns 302 redirect for correct password", async () => {
    const hash = await hashPasswordPBKDF2("secret123");
    const res = await handleRedirect(
      makeReq({ method: "POST", formData: { password: "secret123" } }),
      makeAdapter({ fetchLink: vi.fn().mockResolvedValue(activeLink({ password_hash: hash })) })
    );
    expect(res.status).toBe(302);
    expect(res.headers.Location).toBe("https://example.com");
  });

  it("triggers updateLink for legacy SHA-256 hashes after successful verify", async () => {
    const salt = "legacy-salt";
    const legacyHash = await legacySha256("mypass", salt);
    const updateLink = vi.fn().mockResolvedValue(undefined);
    const res = await handleRedirect(
      makeReq({ method: "POST", formData: { password: "mypass" } }),
      makeAdapter({
        fetchLink: vi.fn().mockResolvedValue(activeLink({ password_hash: legacyHash, password_salt: salt })),
        updateLink,
      })
    );

    expect(res.status).toBe(302);
    expect(updateLink).toHaveBeenCalledOnce();
    const [, fields] = updateLink.mock.calls[0];
    expect((fields as Record<string, unknown>).password_hash).toMatch(/^pbkdf2:/);
    expect((fields as Record<string, unknown>).password_salt).toBeNull();
  });

  it("resolves geo-routing with bypass_url priority", async () => {
    const adapter = makeAdapter({
      fetchLink: vi.fn().mockResolvedValue(
        activeLink({
          default_url: "https://default.com",
          geo_routes: [
            { country_code: "VN", target_url: "https://vn.com", bypass_url: "https://bypass-vn.com" },
            { country_code: "US", target_url: "https://us.com" },
          ],
        })
      ),
    });

    const vn = await handleRedirect(makeReq({ headers: { "user-agent": "Mozilla", "cf-ipcountry": "VN", "x-forwarded-for": "1.2.3.4" } }), adapter);
    const us = await handleRedirect(makeReq({ headers: { "user-agent": "Mozilla", "cf-ipcountry": "US", "x-forwarded-for": "1.2.3.5" } }), adapter);
    const jp = await handleRedirect(makeReq({ headers: { "user-agent": "Mozilla", "cf-ipcountry": "JP", "x-forwarded-for": "1.2.3.6" } }), adapter);

    expect(vn.headers.Location).toBe("https://bypass-vn.com");
    expect(us.headers.Location).toBe("https://us.com");
    expect(jp.headers.Location).toBe("https://default.com");
  });

  it("skips click insert and webhook queue for bot traffic", async () => {
    const insertClick = vi.fn();
    const queueBackgroundTask = vi.fn();
    await handleRedirect(
      makeReq({ headers: { "user-agent": "Googlebot/2.1", "x-forwarded-for": "1.2.3.4" } }),
      makeAdapter({ fetchLink: vi.fn().mockResolvedValue(activeLink({ webhook_url: "https://hooks.example.com" })), insertClick }),
      { queueBackgroundTask }
    );
    expect(insertClick).not.toHaveBeenCalled();
    expect(queueBackgroundTask).not.toHaveBeenCalled();
  });

  it("records click and queues webhook for non-bot traffic", async () => {
    const queued: Promise<void>[] = [];
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    const resolveDnsImpl = vi.fn().mockResolvedValue(["93.184.216.34"]);
    const adapter = makeAdapter({
      fetchLink: vi.fn().mockResolvedValue(activeLink({ webhook_url: "https://hooks.example.com/clicks" })),
      recentClickCount: vi.fn().mockResolvedValue(0),
      insertClick: vi.fn().mockResolvedValue(undefined),
    });

    const res = await handleRedirect(makeReq(), adapter, {
      fetchImpl,
      queueBackgroundTask: (task) => queued.push(task),
      resolveDnsImpl,
    });

    expect(res.status).toBe(302);
    expect(adapter.insertClick).toHaveBeenCalledOnce();
    expect(queued).toHaveLength(1);
    await Promise.all(queued);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://hooks.example.com/clicks",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "X-QRLive-Event": "click.created" }),
      })
    );
  });

  it("skips click insert and webhook when recent click exists within 60s", async () => {
    const insertClick = vi.fn();
    const queueBackgroundTask = vi.fn();
    await handleRedirect(
      makeReq(),
      makeAdapter({
        fetchLink: vi.fn().mockResolvedValue(activeLink({ webhook_url: "https://hooks.example.com" })),
        recentClickCount: vi.fn().mockResolvedValue(1),
        insertClick,
      }),
      { queueBackgroundTask }
    );
    expect(insertClick).not.toHaveBeenCalled();
    expect(queueBackgroundTask).not.toHaveBeenCalled();
  });

  it("returns 400 JSON for invalid redirect targets before recording clicks", async () => {
    const insertClick = vi.fn();
    const res = await handleRedirect(
      makeReq(),
      makeAdapter({
        fetchLink: vi.fn().mockResolvedValue(activeLink({ default_url: "javascript:alert(1)" })),
        insertClick,
      })
    );
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toBe("Invalid redirect target");
    expect(insertClick).not.toHaveBeenCalled();
  });

  it("does not fail redirects when webhook delivery errors", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const queued: Promise<void>[] = [];
    const resolveDnsImpl = vi.fn().mockResolvedValue(["93.184.216.34"]);
    const res = await handleRedirect(
      makeReq(),
      makeAdapter({
        fetchLink: vi.fn().mockResolvedValue(activeLink({ webhook_url: "https://hooks.example.com/fail" })),
      }),
      {
        fetchImpl: vi.fn().mockRejectedValue(new Error("network down")),
        queueBackgroundTask: (task) => queued.push(task),
        resolveDnsImpl,
      }
    );

    expect(res.status).toBe(302);
    await Promise.all(queued);
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("Click webhook delivery failed for https://hooks.example.com/...")
    );
  });

  it("does not fetch webhooks whose DNS resolves to private IPs and still completes the redirect", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const queued: Promise<void>[] = [];
    const fetchImpl = vi.fn();
    const resolveDnsImpl = vi.fn().mockImplementation(async (_hostname: string, recordType: "A" | "AAAA") => (
      recordType === "A" ? ["10.0.0.5"] : []
    ));
    const res = await handleRedirect(
      makeReq(),
      makeAdapter({
        fetchLink: vi.fn().mockResolvedValue(activeLink({ webhook_url: "https://hooks.example.com/private" })),
      }),
      {
        fetchImpl,
        queueBackgroundTask: (task) => queued.push(task),
        resolveDnsImpl,
      }
    );

    expect(res.status).toBe(302);
    await Promise.all(queued);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("Click webhook delivery failed for https://hooks.example.com/...")
    );
  });

  it("passes webhook_secret to dispatchClickWebhook when present on link", async () => {
    const queued: Promise<void>[] = [];
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    const resolveDnsImpl = vi.fn().mockResolvedValue(["93.184.216.34"]);
    const adapter = makeAdapter({
      fetchLink: vi.fn().mockResolvedValue(
        activeLink({ webhook_url: "https://hooks.example.com/clicks", webhook_secret: "test-secret-at-least-16" })
      ),
      recentClickCount: vi.fn().mockResolvedValue(0),
      insertClick: vi.fn().mockResolvedValue(undefined),
    });

    const res = await handleRedirect(makeReq(), adapter, {
      fetchImpl,
      queueBackgroundTask: (task) => queued.push(task),
      resolveDnsImpl,
    });

    expect(res.status).toBe(302);
    await Promise.all(queued);
    const [, init] = fetchImpl.mock.calls[0];
    const headers = init.headers as Record<string, string>;
    expect(headers["X-QRLive-Timestamp"]).toBeDefined();
    expect(headers["X-QRLive-Signature-256"]).toMatch(/^sha256=[a-f0-9]{64}$/);
  });
});
