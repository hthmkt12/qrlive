import "dotenv/config";
import { createServer } from "node:http";
import { Buffer } from "node:buffer";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
import axios from "axios";
import { loadConfig } from "./config.mjs";
import { createUpstreamAgents } from "./proxy-agent.mjs";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function getForwardedProto(headers) {
  if (headers["x-forwarded-proto"]) {
    return String(headers["x-forwarded-proto"]).split(",")[0].trim();
  }

  return headers["x-forwarded-ssl"] === "on" ? "https" : "http";
}

function copyRequestHeaders(headers, upstreamOrigin, remoteAddress) {
  const nextHeaders = {};
  for (const [key, value] of Object.entries(headers)) {
    if (!value || HOP_BY_HOP_HEADERS.has(key.toLowerCase()) || key.toLowerCase() === "host") {
      continue;
    }
    nextHeaders[key] = value;
  }

  nextHeaders.host = upstreamOrigin.host;
  nextHeaders["x-forwarded-host"] = headers.host ?? upstreamOrigin.host;
  nextHeaders["x-forwarded-proto"] = getForwardedProto(headers);
  nextHeaders["x-forwarded-for"] = headers["x-forwarded-for"]
    ? `${headers["x-forwarded-for"]}, ${remoteAddress}`
    : remoteAddress;

  return nextHeaders;
}

function copyResponseHeaders(headers, upstreamOrigin, publicOrigin) {
  const nextHeaders = {};

  for (const [key, value] of Object.entries(headers)) {
    if (!value || HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      continue;
    }

    if (key.toLowerCase() === "location") {
      const locations = Array.isArray(value) ? value : [value];
      nextHeaders[key] = locations.map((entry) =>
        entry.startsWith(upstreamOrigin.origin)
          ? `${publicOrigin}${entry.slice(upstreamOrigin.origin.length)}`
          : entry
      );
      continue;
    }

    nextHeaders[key] = value;
  }

  return nextHeaders;
}

function json(res, statusCode, payload) {
  const body = Buffer.from(JSON.stringify(payload));
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": body.byteLength,
    "cache-control": "no-store",
  });
  res.end(body);
}

function getPublicOrigin(req) {
  const host = req.headers.host;
  const proto = getForwardedProto(req.headers);
  return `${proto}://${host}`;
}

export function createProxyGatewayServer(config = loadConfig()) {
  const agents = createUpstreamAgents(config.outboundProxyUrl);

  return createServer(async (req, res) => {
    const requestUrl = new URL(req.url ?? "/", config.upstreamOrigin);

    if (requestUrl.pathname === "/health") {
      // F13: only reveal upstreamOrigin if HEALTH_REVEAL_UPSTREAM=true (prevents GFW fingerprinting)
      const payload = { status: "ok", proxyMode: agents.proxyLabel };
      if (config.healthRevealUpstream) payload.upstreamOrigin = config.upstreamOrigin.origin;
      return json(res, 200, payload);
    }

    try {
      const upstreamResponse = await axios.request({
        method: req.method,
        url: requestUrl.toString(),
        headers: copyRequestHeaders(req.headers, config.upstreamOrigin, req.socket.remoteAddress ?? "unknown"),
        data: req.method === "GET" || req.method === "HEAD" ? undefined : req,
        responseType: "stream",
        validateStatus: () => true,
        maxRedirects: config.maxRedirects,
        timeout: config.requestTimeoutMs,
        proxy: false,
        httpAgent: agents.httpAgent,
        httpsAgent: agents.httpsAgent,
      });

      const responseHeaders = copyResponseHeaders(
        upstreamResponse.headers,
        config.upstreamOrigin,
        getPublicOrigin(req)
      );

      res.writeHead(upstreamResponse.status, responseHeaders);
      await pipeline(upstreamResponse.data, res);
    } catch (error) {
      const statusCode = error.code === "ECONNABORTED" ? 504 : 502;
      json(res, statusCode, {
        error: "UPSTREAM_PROXY_FAILED",
        message: error.message,
      });
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const config = loadConfig();
  const server = createProxyGatewayServer(config);

  server.listen(config.port, "0.0.0.0", () => {
    console.log(
      `proxy-gateway listening on :${config.port} -> ${config.upstreamOrigin.origin} via ${
        config.outboundProxyUrl?.protocol ?? "direct"
      }`
    );
  });
}
