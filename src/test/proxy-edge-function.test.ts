import { describe, expect, it, vi } from "vitest";
import {
  handleProxy,
  timingSafeEqual,
  type ProxyRequest,
  type ProxyRuntimeOptions,
} from "../../supabase/functions/proxy/proxy-handler";

/* ── Test helpers ──────────────────────────────────────────────────── */

const ANON_KEY = "test-anon-key";
const SECRET = "test-proxy-secret";

function defaultOptions(overrides: Partial<ProxyRuntimeOptions> = {}): ProxyRuntimeOptions {
  return {
    proxySecret: SECRET,
    supabaseAnonKey: ANON_KEY,
    allowedHosts: ["www.example.com", "cdn.example.com"],
    allowedOrigin: "https://qrlive.vercel.app",
    ...overrides,
  };
}

function makeReq(overrides: Partial<ProxyRequest> = {}): ProxyRequest {
  return {
    method: "GET",
    url: `https://edge.supabase.co/functions/v1/proxy?url=https://www.example.com/page&key=${SECRET}`,
    headers: { authorization: `Bearer ${ANON_KEY}` },
    ...overrides,
  };
}

function parseBody(res: { body: Uint8Array | null }): Record<string, string> {
  return JSON.parse(new TextDecoder().decode(res.body!));
}

/* ── Tests ─────────────────────────────────────────────────────────── */

describe("proxy-handler", () => {
  it("returns 200 with CORS methods for OPTIONS preflight", async () => {
    const res = await handleProxy(makeReq({ method: "OPTIONS" }), defaultOptions());
    expect(res.status).toBe(200);
    expect(res.headers["Access-Control-Allow-Methods"]).toBe("GET, OPTIONS");
    expect(res.headers["Access-Control-Allow-Origin"]).toBe("https://qrlive.vercel.app");
  });

  it("returns 401 JSON for missing Authorization header", async () => {
    const res = await handleProxy(makeReq({ headers: {} }), defaultOptions());
    expect(res.status).toBe(401);
    expect(parseBody(res).error).toBe("Unauthorized");
  });

  it("returns 401 JSON for invalid Authorization header", async () => {
    const res = await handleProxy(
      makeReq({ headers: { authorization: "Bearer wrong-key" } }),
      defaultOptions(),
    );
    expect(res.status).toBe(401);
    expect(parseBody(res).error).toBe("Unauthorized");
  });

  it("returns 401 JSON for wrong key query param", async () => {
    const res = await handleProxy(
      makeReq({ url: `https://edge.supabase.co/functions/v1/proxy?url=https://www.example.com&key=wrong-secret` }),
      defaultOptions(),
    );
    expect(res.status).toBe(401);
    expect(parseBody(res).error).toBe("Unauthorized");
  });

  it("returns 403 JSON for non-allowlisted host", async () => {
    const res = await handleProxy(
      makeReq({ url: `https://edge.supabase.co/functions/v1/proxy?url=https://evil.com/page&key=${SECRET}` }),
      defaultOptions(),
    );
    expect(res.status).toBe(403);
    expect(parseBody(res).error).toBe("Host not allowed");
  });

  it("preserves Content-Type and Content-Length on successful fetch", async () => {
    const body = new TextEncoder().encode("<html>OK</html>");
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(body, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8", "Content-Length": String(body.length) },
      }),
    );
    const res = await handleProxy(makeReq(), defaultOptions({ fetchImpl }));
    expect(res.status).toBe(200);
    expect(res.headers["Content-Type"]).toBe("text/html; charset=utf-8");
    expect(res.headers["Content-Length"]).toBe(String(body.length));
    expect(new TextDecoder().decode(res.body!)).toBe("<html>OK</html>");
  });

  it("fetches upstream with redirect: manual", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response("ok", { status: 200, headers: { "Content-Type": "text/plain" } }),
    );
    await handleProxy(makeReq(), defaultOptions({ fetchImpl }));
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://www.example.com/page",
      expect.objectContaining({ redirect: "manual" }),
    );
  });

  it("passes through 3xx + Location when redirect target is allowlisted", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(null, { status: 301, headers: { Location: "https://cdn.example.com/new-page" } }),
    );
    const res = await handleProxy(makeReq(), defaultOptions({ fetchImpl }));
    expect(res.status).toBe(301);
    expect(res.headers["Location"]).toBe("https://cdn.example.com/new-page");
  });

  it("returns 403 JSON when redirect target is NOT allowlisted", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(null, { status: 302, headers: { Location: "https://evil.com/phish" } }),
    );
    const res = await handleProxy(makeReq(), defaultOptions({ fetchImpl }));
    expect(res.status).toBe(403);
    expect(parseBody(res).error).toBe("Redirect target not allowed");
  });

  it("returns 413 JSON when Content-Length exceeds 6 MB", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response("too big", {
        status: 200,
        headers: { "Content-Type": "text/plain", "Content-Length": String(7 * 1024 * 1024) },
      }),
    );
    const res = await handleProxy(makeReq(), defaultOptions({ fetchImpl }));
    expect(res.status).toBe(413);
    expect(parseBody(res).error).toBe("Response too large");
  });

  it("returns JSON timeout error when fetch times out", async () => {
    const fetchImpl = vi.fn().mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        }),
    );
    const res = await handleProxy(makeReq(), defaultOptions({ fetchImpl, timeoutMs: 50 }));
    expect(res.status).toBe(504);
    expect(parseBody(res).error).toBe("Upstream timeout");
  });
});

describe("timingSafeEqual", () => {
  it("returns true for identical strings", () => {
    expect(timingSafeEqual("secret", "secret")).toBe(true);
  });

  it("returns false for same-length different strings", () => {
    expect(timingSafeEqual("aaaaaa", "bbbbbb")).toBe(false);
  });

  it("returns false for different-length strings without early return", () => {
    expect(timingSafeEqual("short", "muchlongerstring")).toBe(false);
  });
});
