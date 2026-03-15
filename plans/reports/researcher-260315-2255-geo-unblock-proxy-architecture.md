# Research Report: Geo-Unblock Proxy Architecture for QR Link Redirector

**Date:** 2026-03-15
**Context:** Supabase Edge Function (Deno) redirect handler needing geo-bypass for ISP-blocked URLs (Vietnam context)

---

## 1. How Proxy-Based Geo-Unblock Services Work

### Block Types in Vietnam

Vietnamese ISP blocking operates at two levels:
- **DNS-level**: ISP returns NXDOMAIN or hijacks DNS for blocked domains. Solved by changing DNS (1.1.1.1, 8.8.8.8).
- **IP-level / deep packet inspection (DPI)**: ISP drops or resets TCP connections to blocked IP ranges. DNS bypass alone is insufficient. Requires routing through a foreign exit node.

Most ISP blocks in Vietnam targeting specific foreign content (e.g., certain media, social, or political sites) use IP-level blocking. The destination IP is what matters, not the domain name.

### Architecture Patterns

#### Pattern A: Simple Redirect Chain
```
User → shortener (302 → proxy.example.com/fetch?url=TARGET) → proxy fetches & serves
```
User's browser receives a 302 to an intermediary URL hosted outside Vietnam. The intermediary fetches the blocked content from its foreign IP and serves it back. The user's browser sees the intermediary's domain in the address bar.

**Pros:** Simple, no content rewriting needed for static resources.
**Cons:** Relative URLs in HTML break (images, CSS, JS point back to original domain). Requires rewriting HTML response or using base-href injection.

#### Pattern B: Content Proxy (Full Reverse Proxy)
The proxy fetches HTML, rewrites all relative/absolute links to route through itself, rewrites `<script src>`, `<link href>`, `<img src>` to proxy URLs. Then serves the rewritten HTML. Every subsequent asset request also goes through the proxy.

**Complexity:** Very high. Breaks JavaScript-heavy SPAs. Not practical to implement in an Edge Function.

#### Pattern C: Direct Fetch & Pipe (Transparent Proxy)
```
User → Worker/Edge Function → fetch(TARGET) → stream response body back
```
The edge function fetches the blocked URL server-side and pipes the raw response back to the user. The URL in the browser stays at the proxy domain. Only works for single-resource responses (PDFs, direct file downloads, simple HTML pages without relative links).

**Best fit for:** Downloading a specific file or resource, not for browsing multi-page sites.

### How URL Shorteners Implement "Bypass Mode"
Commercial services (Bitly, Short.io, Rebrandly) do **not** implement content proxying — they only do 301/302 redirects. "Bypass mode" is not a standard URL shortener feature. What exists in the wild:
- Route the short link to a **mirror domain** not on the blocklist.
- Route to a **cached version** (Google Cache, Wayback Machine, archive.ph).
- Route to a **translation proxy** (translate.google.com/translate?u=TARGET — often works because Google's IPs are rarely blocked).

---

## 2. Cloudflare Workers as Reverse Proxy

### Technical Feasibility
A Cloudflare Worker **can** fetch a remote URL and stream the response back:

```javascript
// worker.js
export default {
  async fetch(request, env) {
    const targetUrl = new URL(request.url).searchParams.get("url");
    if (!targetUrl) return new Response("Missing url param", { status: 400 });

    const upstream = await fetch(targetUrl, {
      method: request.method,
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    // Stream response body directly — no buffering
    return new Response(upstream.body, {
      status: upstream.status,
      headers: upstream.headers,
    });
  }
};
```

The response body is a `ReadableStream` — Cloudflare Workers support streaming natively.

### Limits (as of 2025)
| Constraint | Free Plan | Paid (Workers Paid) |
|---|---|---|
| CPU time per request | 10ms | 30s (configurable up to 5min) |
| Memory per isolate | 128MB | 128MB |
| Subrequests | 50 | 10,000 |
| Response body size (CDN cache) | 512MB | 512MB |
| Network I/O | Not counted toward CPU | Not counted toward CPU |

**Key:** `fetch()` calls inside a Worker don't count toward the CPU time limit — only JS execution does. This means streaming large files is feasible on the paid plan.

### Critical Limitations
1. **10ms CPU on free plan**: Any non-trivial HTML rewriting will exceed this. Pure pipe-through is marginal.
2. **Workers IP ranges**: Cloudflare Workers' egress IPs are shared and well-known. Some sites block Worker IPs (the `CF-Worker` header identifies origin). The Worker can set custom headers to strip this.
3. **workers.dev domain**: Using `*.workers.dev` means the proxy domain itself may get blocked by Vietnamese ISPs or DNS filters over time.
4. **Terms of Service**: Cloudflare explicitly states Workers are not a circumvention tool for government restrictions. Using Workers to bypass Vietnamese government-mandated blocks could result in account termination.
5. **CORS**: Worker can set `Access-Control-Allow-Origin: *` but upstream CORS restrictions don't affect server-side `fetch()`.
6. **HTML with relative links**: Relative links in fetched HTML resolve against the worker URL, not the original domain — breaks most websites.

### Verdict: Viable for file downloads / single-resource fetches. Not for proxying full websites. Policy risk is real.

---

## 3. Supabase Edge Functions (Deno) as Reverse Proxy

### Technical Feasibility
Deno's `fetch()` supports streaming via Web Streams API:

```typescript
// supabase/functions/proxy/index.ts
Deno.serve(async (req) => {
  const url = new URL(req.url).searchParams.get("url");
  if (!url) return new Response("Missing url", { status: 400 });

  const upstream = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });

  // Pipe the ReadableStream directly — no buffering
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/octet-stream",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
```

This pattern avoids buffering and works within memory constraints.

### Limits (as of 2025)
| Constraint | Value |
|---|---|
| Max memory | 256MB |
| CPU time per request | 2s (excl. async I/O) |
| Request idle timeout | 150s (free), 400s (paid) |
| Max function bundle size | 20MB |
| Outbound SMTP (25, 587) | Blocked |
| Response size | Not explicitly documented; limited by timeout + memory |

**Key issue:** The 2s CPU cap is for JavaScript execution, not wall-clock time. A streaming fetch where the proxy just pipes bytes uses nearly zero CPU — mainly async I/O. So large file proxying is feasible under the 150s/400s wall-clock limit.

**Undocumented response size limit:** Community reports indicate truncation (EF035 error) for very large payloads. Streaming mitigates this by not buffering, but if the upstream response is slow and crosses the idle timeout, the connection drops.

### Deployment Consideration
Supabase Edge Functions deploy to regional nodes. The Vietnamese user's request hits the nearest Supabase PoP (likely Singapore or Tokyo). The Edge Function's `fetch()` to the blocked URL exits from **that PoP's IP** — which is a Singapore/Tokyo IP, not a Vietnamese IP. Since Vietnamese ISP blocks are on the **client side** (user's connection to the destination), the Edge Function server-side fetch is unaffected by the block.

This is the key insight: the **user can't reach** the blocked destination, but the **Edge Function can** because it runs on a foreign IP.

### Verdict: Technically feasible for the use case. Same HTML-relative-link limitation as Cloudflare Workers. Slightly better memory ceiling (256MB vs 128MB).

---

## 4. Alternative Approaches

### 4A. Redirect to Translation Proxy
```
302 → https://translate.google.com/translate?sl=auto&tl=en&u=ENCODED_TARGET_URL
```
Google Translate acts as a transparent HTTP proxy. Renders the full page through Google's servers. Google's IPs are almost never blocked.

**Pros:** Zero infrastructure. Works immediately. Handles HTML rewriting correctly.
**Cons:** Adds Google's translation UI overlay. Doesn't work for apps that need authentication. Looks unpolished. Target site may have HTTPS issues with translate proxy.

**Best for:** Simple read-only content (news articles, documentation).

### 4B. Redirect to Archive/Cache
```
302 → https://web.archive.org/web/*/TARGET_URL
302 → https://archive.ph/TARGET_URL
302 → https://webcache.googleusercontent.com/search?q=cache:TARGET_URL
```
Only works if the page has been indexed/cached. Stale content. Not suitable for dynamic pages. Google Cache was deprecated in 2024.

### 4C. Redirect to a Mirror Domain
If you control the content, host it on a second domain not on Vietnam's blocklist. The shortener just redirects to the mirror. No proxy needed.

**Pros:** Most robust long-term. Full performance.
**Cons:** Requires control over destination content and infrastructure.

### 4D. Free CORS Proxy APIs
Services like `allorigins.win`, `corsproxy.io`, `cors.sh`:
- Return the fetched content as JSON (`{contents: "..."}`) or raw
- Designed for browser-side CORS bypass, not full page proxy
- Rate-limited, unreliable for production
- Not suitable for non-HTML resources (binary files)

**Verdict: Only for development/testing. Not production-reliable.**

### 4E. Cloudflare Tunnel (Argo)
Cloudflare Tunnel creates an outbound-only tunnel from a private server to Cloudflare's edge. The server can be in a country where the content is accessible. Requests come in via Cloudflare, get tunneled to the server, which fetches and returns content.

**Requires:** A VPS or server running `cloudflared` daemon outside Vietnam.
**Pros:** Reliable, no open inbound ports, uses Cloudflare's CDN.
**Cons:** Requires a server (cost). Overkill for personal tool.

---

## 5. Legal & Ethical Considerations (Vietnam)

### Cybersecurity Law 2018 (Luật An ninh mạng 2018)
- Applies to enterprises providing services in Vietnam's cyberspace
- Requires data localization for "domestic companies providing telecoms, internet, value-added services"
- Mandates takedown of content deemed harmful to national security, social order
- **Does not explicitly criminalize personal use of VPN/proxy** but grants broad powers to authorities to require content removal

### Decree 13/2023 (Personal Data Protection)
- Focuses on **personal data processing**, not content access/bypass
- Relevant if the proxy logs user IPs and click data (which the existing Edge Function already does)
- Requires lawful basis for processing; consent mechanisms needed for data collection

### What this means for a personal bypass tool:
- **Hosting provider risk:** If you use Cloudflare Workers or Supabase, both are US companies with ToS that prohibit circumventing government restrictions. Account termination is the primary risk.
- **User risk (personal use):** Vietnam does not currently prosecute individuals for personal VPN/proxy use, but the law provides the framework to do so. Risk is low for personal/small-scale tools.
- **Commercial risk:** Building this as a public service for Vietnamese users would create significant legal exposure under the Cybersecurity Law.
- **Content sensitivity:** The risk scales with what content is being unblocked. News articles = low risk. Political content, gambling, adult content = high risk.

**Bottom line:** For a personal/small-team QR link tool, the practical legal risk is minimal. The ToS risk with Cloudflare/Supabase is more immediate than legal risk.

---

## 6. Practical Recommendation

### Problem Statement Reframed
The existing `redirect/index.ts` already does 302 redirects. The user can't reach the destination because Vietnamese ISP blocks the destination IP. The fix is to route the user through a foreign intermediary.

### Recommended Architecture: Tiered Redirect with Fallback

```
QR Scan → Supabase redirect function
  ├─ if link.bypass_mode == false → 302 to destination_url (current behavior)
  └─ if link.bypass_mode == true →
       ├─ Option A: 302 to translate.google.com/translate?u=destination_url
       └─ Option B: 302 to worker.yourdomain.com/proxy?url=destination_url
```

Add a `bypass_mode` boolean column to `qr_links` table.

### Option A: Google Translate Proxy (Zero Infrastructure)
For read-only content (articles, pages). No code change needed beyond the redirect target.

```typescript
// In redirect/index.ts, modify the targetUrl construction:
if (link.bypass_mode) {
  const encoded = encodeURIComponent(targetUrl);
  targetUrl = `https://translate.google.com/translate?sl=auto&tl=vi&u=${encoded}`;
}
return new Response(null, { status: 302, headers: { Location: targetUrl } });
```

### Option B: Cloudflare Worker Content Proxy (Own Infrastructure)
For file downloads or when Google Translate UI is unacceptable.

Deploy a Cloudflare Worker on a **custom domain** (not `workers.dev`) to avoid domain-level blocking:

```javascript
// cloudflare-proxy-worker.js
export default {
  async fetch(request) {
    const params = new URL(request.url).searchParams;
    const target = params.get("url");

    if (!target) return new Response("Missing url", { status: 400 });

    // Simple allowlist to prevent open proxy abuse
    const ALLOWED_ORIGINS = ["yourdomain.com", "specific-blocked-site.com"];
    const targetHost = new URL(target).hostname;
    if (!ALLOWED_ORIGINS.some(h => targetHost.endsWith(h))) {
      return new Response("Not allowed", { status: 403 });
    }

    const resp = await fetch(target, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MyApp/1.0)" },
    });

    const headers = new Headers(resp.headers);
    headers.set("Access-Control-Allow-Origin", "*");
    // Remove headers that cause issues
    headers.delete("Content-Security-Policy");
    headers.delete("X-Frame-Options");

    return new Response(resp.body, { status: resp.status, headers });
  }
};
```

### Simplest Implementation Path

1. Add `bypass_mode BOOLEAN DEFAULT false` and `bypass_proxy_url TEXT` columns to `qr_links`
2. In `redirect/index.ts`, if `bypass_mode = true`, prepend the proxy URL to the target
3. Deploy Cloudflare Worker on custom domain OR use Google Translate shortcut
4. UI: Add "Enable bypass for blocked regions" toggle when creating/editing a link

### What NOT to build
- Full HTML-rewriting content proxy — too complex, breaks JS apps, not worth it
- Self-hosted proxy server — operational overhead kills the personal tool goal
- Open proxy (no allowlist) — will be abused and get your Worker account banned

---

## Summary Table

| Approach | Complexity | Reliability | Cost | Best For |
|---|---|---|---|---|
| Google Translate redirect | Minimal | High | Free | Read-only HTML content |
| Cloudflare Worker pipe | Low | Medium | Free tier | File downloads, simple pages |
| Supabase Edge Function pipe | Low | Medium | Free tier | Same as above, already in stack |
| Mirror domain redirect | Medium | High | VPS cost | Controlled content |
| Archive/cache redirect | Minimal | Low | Free | Fallback only |
| Full HTML-rewriting proxy | Very High | Low | High | Don't build this |

---

## Unresolved Questions

1. **What specific content is being blocked?** Full HTML pages vs. file downloads changes the best approach significantly.
2. **Is the blocking DNS-level or IP-level?** If DNS-only, a simple CNAME to a CDN with a different domain may suffice without any proxy.
3. **Supabase undocumented response size ceiling:** No official number found. Community reports EF035 truncation but no size threshold documented. Streaming mitigates but doesn't eliminate the risk for very large files.
4. **Cloudflare ToS enforcement:** Whether Cloudflare actively enforces the "no circumvention" clause for personal-scale tools is unclear. No documented cases of enforcement against small personal tools found.
5. **Custom domain for Cloudflare Worker:** Does the user own a domain suitable for hosting the bypass worker? If not, `workers.dev` subdomain may itself get blocked by ISPs.

---

## Sources

- [Cloudflare Workers Limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Supabase Edge Functions Limits](https://supabase.com/docs/guides/functions/limits)
- [Deno Web Streams at the Edge](https://deno.com/blog/deploy-streams)
- [How to Set Up Reverse Proxy with Cloudflare Workers](https://dev.to/wfhalert/how-to-set-up-a-simple-reverse-proxy-using-cloudflare-workers-l6d)
- [Cloudflare Workers Reverse Proxy - Servebolt](https://servebolt.com/help/cloudflare/cloudflare-workers-reverse-proxy/)
- [Cloudflare Website Terms of Use](https://workers.cloudflare.com/policies/terms)
- [Vietnam Cybersecurity Law Timeline](https://www.thevietnamese.org/2023/08/vietnams-cybersecurity-law-a-timeline/)
- [KPMG: Decree 13 Legal Alert](https://kpmg.com/vn/en/home/insights/2023/04/legal-alert-on-decree-13.html)
- [ReadableStream as Response.body issue in Supabase Edge Runtime](https://github.com/supabase/edge-runtime/issues/91)
- [Cloudflare Community: Vietnam ISP Blocking](https://community.cloudflare.com/t/my-website-is-blocked-by-isp-at-vietnam/791189)
