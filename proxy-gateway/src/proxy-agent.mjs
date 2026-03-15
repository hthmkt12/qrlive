import { HttpProxyAgent } from "http-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";

export function createUpstreamAgents(proxyUrl) {
  if (!proxyUrl) {
    return {
      httpAgent: undefined,
      httpsAgent: undefined,
      proxyLabel: "direct",
    };
  }

  if (proxyUrl.protocol === "socks5:" || proxyUrl.protocol === "socks5h:") {
    const agent = new SocksProxyAgent(proxyUrl);
    return {
      httpAgent: agent,
      httpsAgent: agent,
      proxyLabel: proxyUrl.protocol.replace(":", ""),
    };
  }

  if (proxyUrl.protocol === "http:" || proxyUrl.protocol === "https:") {
    return {
      httpAgent: new HttpProxyAgent(proxyUrl),
      httpsAgent: new HttpsProxyAgent(proxyUrl),
      proxyLabel: proxyUrl.protocol.replace(":", ""),
    };
  }

  throw new Error(`Unsupported proxy protocol: ${proxyUrl.protocol}`);
}
