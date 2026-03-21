import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import test from "node:test";
import { loadConfig } from "../src/config.mjs";
import { createUpstreamAgents } from "../src/proxy-agent.mjs";
import { createProxyGatewayServer } from "../src/server.mjs";

async function startServer(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

async function stopServer(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

test("health endpoint reports direct mode, hides upstreamOrigin by default (F13)", async (t) => {
  const gateway = createProxyGatewayServer({
    port: 0,
    requestTimeoutMs: 1_000,
    maxRedirects: 0,
    upstreamOrigin: new URL("https://example.com"),
    outboundProxyUrl: null,
    healthRevealUpstream: false,
  });

  t.after(() => stopServer(gateway));

  const gatewayBaseUrl = await startServer(gateway);
  const response = await fetch(`${gatewayBaseUrl}/health`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok", proxyMode: "direct" });
});

test("health endpoint reveals upstreamOrigin when HEALTH_REVEAL_UPSTREAM=true", async (t) => {
  const gateway = createProxyGatewayServer({
    port: 0,
    requestTimeoutMs: 1_000,
    maxRedirects: 0,
    upstreamOrigin: new URL("https://example.com"),
    outboundProxyUrl: null,
    healthRevealUpstream: true,
  });

  t.after(() => stopServer(gateway));

  const gatewayBaseUrl = await startServer(gateway);
  const response = await fetch(`${gatewayBaseUrl}/health`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: "ok",
    proxyMode: "direct",
    upstreamOrigin: "https://example.com",
  });
});

test("gateway forwards requests and rewrites upstream redirects", async (t) => {
  let upstreamBaseUrl = "";

  const upstream = createServer((req, res) => {
    if (req.url === "/redirect") {
      res.writeHead(302, {
        location: `${upstreamBaseUrl}/next`,
      });
      res.end();
      return;
    }

    res.writeHead(200, {
      "content-type": "application/json",
    });
    res.end(
      JSON.stringify({
        path: req.url,
        host: req.headers.host,
        forwardedHost: req.headers["x-forwarded-host"],
        forwardedProto: req.headers["x-forwarded-proto"],
      })
    );
  });

  t.after(() => stopServer(upstream));
  upstreamBaseUrl = await startServer(upstream);

  const gateway = createProxyGatewayServer({
    port: 0,
    requestTimeoutMs: 1_000,
    maxRedirects: 0,
    upstreamOrigin: new URL(upstreamBaseUrl),
    outboundProxyUrl: null,
  });

  t.after(() => stopServer(gateway));

  const gatewayBaseUrl = await startServer(gateway);
  const upstreamOrigin = new URL(upstreamBaseUrl);
  const gatewayOrigin = new URL(gatewayBaseUrl);

  const proxyResponse = await fetch(`${gatewayBaseUrl}/hello?x=1`);
  const payload = await proxyResponse.json();

  assert.equal(proxyResponse.status, 200);
  assert.equal(payload.path, "/hello?x=1");
  assert.equal(payload.host, upstreamOrigin.host);
  assert.equal(payload.forwardedHost, gatewayOrigin.host);
  assert.equal(payload.forwardedProto, gatewayOrigin.protocol.replace(":", ""));

  const redirectResponse = await fetch(`${gatewayBaseUrl}/redirect`, {
    redirect: "manual",
  });

  assert.equal(redirectResponse.status, 302);
  assert.equal(redirectResponse.headers.get("location"), `${gatewayBaseUrl}/next`);
});

test("gateway returns 504 when upstream times out", async (t) => {
  const upstream = createServer(() => {
    // intentionally never respond to trigger timeout
  });

  t.after(() => stopServer(upstream));
  const upstreamBaseUrl = await startServer(upstream);

  const gateway = createProxyGatewayServer({
    port: 0,
    requestTimeoutMs: 50,
    maxRedirects: 0,
    upstreamOrigin: new URL(upstreamBaseUrl),
    outboundProxyUrl: null,
  });

  t.after(() => stopServer(gateway));
  const gatewayBaseUrl = await startServer(gateway);

  const response = await fetch(`${gatewayBaseUrl}/timeout`);
  const payload = await response.json();

  assert.equal(response.status, 504);
  assert.equal(payload.error, "UPSTREAM_PROXY_FAILED");
});

test("gateway returns 502 when upstream connection closes unexpectedly", async (t) => {
  const upstream = createServer((req, res) => {
    req.socket.destroy();
    res.end();
  });

  t.after(() => stopServer(upstream));
  const upstreamBaseUrl = await startServer(upstream);

  const gateway = createProxyGatewayServer({
    port: 0,
    requestTimeoutMs: 200,
    maxRedirects: 0,
    upstreamOrigin: new URL(upstreamBaseUrl),
    outboundProxyUrl: null,
  });

  t.after(() => stopServer(gateway));
  const gatewayBaseUrl = await startServer(gateway);

  const response = await fetch(`${gatewayBaseUrl}/connection-closed`);
  const payload = await response.json();

  assert.equal(response.status, 502);
  assert.equal(payload.error, "UPSTREAM_PROXY_FAILED");
});

test("config validation and proxy agent selection support vendor proxy urls", () => {
  const config = loadConfig({
    UPSTREAM_ORIGIN: "https://www.company.com",
    OUTBOUND_PROXY_URL: "socks5://user:pass@proxy.vendor.com:1080",
    PORT: "9090",
  });

  assert.equal(config.port, 9090);
  assert.equal(config.outboundProxyUrl.protocol, "socks5:");
  assert.equal(createUpstreamAgents(config.outboundProxyUrl).proxyLabel, "socks5");

  assert.throws(
    () => loadConfig({ UPSTREAM_ORIGIN: "ftp://www.company.com" }),
    /UPSTREAM_ORIGIN must use http or https/
  );

  assert.throws(
    () =>
      loadConfig({
        UPSTREAM_ORIGIN: "https://www.company.com",
        OUTBOUND_PROXY_URL: "ftp://proxy.vendor.com:21",
      }),
    /OUTBOUND_PROXY_URL must use one of/
  );
});
