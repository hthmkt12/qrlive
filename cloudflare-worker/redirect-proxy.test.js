import { describe, it, expect, vi, beforeEach } from "vitest";
import { extractShortCode, buildUpstreamHeaders } from "./redirect-proxy.js";

// --- extractShortCode ---

describe("extractShortCode", () => {
  it("extracts code from /CODE", () => {
    expect(extractShortCode("/ABC123")).toBe("ABC123");
  });

  it("extracts code from /r/CODE", () => {
    expect(extractShortCode("/r/ABC123")).toBe("ABC123");
  });

  it("returns null for empty path /", () => {
    expect(extractShortCode("/")).toBeNull();
  });

  it("returns null for bare /r/", () => {
    expect(extractShortCode("/r/")).toBeNull();
  });

  it("handles trailing slashes on /CODE/", () => {
    expect(extractShortCode("/ABC123/")).toBe("ABC123");
  });
});

// --- buildUpstreamHeaders ---

describe("buildUpstreamHeaders", () => {
  it("injects apikey and Authorization from anonKey", () => {
    const result = buildUpstreamHeaders(new Headers(), "test-key");
    expect(result.get("apikey")).toBe("test-key");
    expect(result.get("Authorization")).toBe("Bearer test-key");
  });

  it("preserves cf-ipcountry for geo-routing", () => {
    const result = buildUpstreamHeaders(new Headers({ "cf-ipcountry": "VN" }), "k");
    expect(result.get("cf-ipcountry")).toBe("VN");
  });

  it("preserves user-agent and content-type", () => {
    const incoming = new Headers({
      "user-agent": "Mozilla/5.0",
      "content-type": "application/json",
    });
    const result = buildUpstreamHeaders(incoming, "k");
    expect(result.get("user-agent")).toBe("Mozilla/5.0");
    expect(result.get("content-type")).toBe("application/json");
  });

  it("does not leak arbitrary headers", () => {
    const result = buildUpstreamHeaders(new Headers({ "x-custom-secret": "leak" }), "k");
    expect(result.get("x-custom-secret")).toBeNull();
  });
});

// --- Proxy forwarding contract ---

describe("proxy forwarding contract", () => {
  const ENV = {
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_ANON_KEY: "anon-key-123",
  };

  let worker;
  let fetchSpy;

  beforeEach(async () => {
    const mod = await import("./redirect-proxy.js");
    worker = mod.default;
    // Mock global fetch to capture what the worker sends upstream
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("OK", { status: 302, headers: { Location: "https://example.com" } }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds upstream URL from SUPABASE_URL + /functions/v1/redirect/{code}", async () => {
    const req = new Request("https://r.example.com/ABC123", {
      headers: new Headers(),
    });
    await worker.fetch(req, ENV);
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://project.supabase.co/functions/v1/redirect/ABC123");
  });

  it("injects apikey and Authorization headers from SUPABASE_ANON_KEY", async () => {
    const req = new Request("https://r.example.com/XYZ", {
      headers: new Headers(),
    });
    await worker.fetch(req, ENV);
    const [, opts] = fetchSpy.mock.calls[0];
    expect(opts.headers.get("apikey")).toBe("anon-key-123");
    expect(opts.headers.get("Authorization")).toBe("Bearer anon-key-123");
  });

  it("preserves cf-ipcountry header for geo-routing", async () => {
    const req = new Request("https://r.example.com/GEO", {
      headers: new Headers({ "cf-ipcountry": "CN" }),
    });
    await worker.fetch(req, ENV);
    const [, opts] = fetchSpy.mock.calls[0];
    expect(opts.headers.get("cf-ipcountry")).toBe("CN");
  });

  it("forwards POST body for password-protected requests", async () => {
    const body = JSON.stringify({ password: "secret123" });
    const req = new Request("https://r.example.com/PWD", {
      method: "POST",
      headers: new Headers({ "content-type": "application/json" }),
      body,
    });
    await worker.fetch(req, ENV);
    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://project.supabase.co/functions/v1/redirect/PWD");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
  });

  it("uses redirect: manual to pass through Supabase redirects", async () => {
    const req = new Request("https://r.example.com/RDR", {
      headers: new Headers(),
    });
    await worker.fetch(req, ENV);
    const [, opts] = fetchSpy.mock.calls[0];
    expect(opts.redirect).toBe("manual");
  });

  it("handles /r/CODE path the same as /CODE", async () => {
    const req = new Request("https://r.example.com/r/ALT", {
      headers: new Headers(),
    });
    await worker.fetch(req, ENV);
    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://project.supabase.co/functions/v1/redirect/ALT");
  });
});

// --- Error handling ---

describe("worker error handling", () => {
  let worker;

  beforeEach(async () => {
    const mod = await import("./redirect-proxy.js");
    worker = mod.default;
  });

  it("returns 500 JSON when SUPABASE_URL is missing", async () => {
    const res = await worker.fetch(
      new Request("https://r.example.com/CODE"),
      { SUPABASE_ANON_KEY: "k" },
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("SUPABASE_URL");
  });

  it("returns 404 JSON for empty short code", async () => {
    const res = await worker.fetch(
      new Request("https://r.example.com/"),
      { SUPABASE_URL: "https://x.co", SUPABASE_ANON_KEY: "k" },
    );
    expect(res.status).toBe(404);
  });

  it("returns 405 for unsupported methods", async () => {
    const res = await worker.fetch(
      new Request("https://r.example.com/CODE", { method: "DELETE" }),
      { SUPABASE_URL: "https://x.co", SUPABASE_ANON_KEY: "k" },
    );
    expect(res.status).toBe(405);
  });

  it("returns CORS headers for OPTIONS", async () => {
    const res = await worker.fetch(
      new Request("https://r.example.com/CODE", { method: "OPTIONS" }),
      { SUPABASE_URL: "https://x.co", SUPABASE_ANON_KEY: "k" },
    );
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });
});
