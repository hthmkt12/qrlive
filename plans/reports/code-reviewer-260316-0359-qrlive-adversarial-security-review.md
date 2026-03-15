# Adversarial Security Review — QRLive Production Ready Plan

**Date:** 2026-03-16 | **Reviewer:** code-reviewer (Security Adversary) | **Plan:** 260315-2245-qrlive-production-ready

---

## Finding 1: Open Redirect via Unvalidated bypass_url — User-Controlled Phishing Vector

- **Severity:** Critical
- **Location:** Phase 09, TASK-49 "Update Edge Function — bypass_url priority"
- **Flaw:** The edge function redirects to `bypass_url` without any server-side URL validation. The value comes directly from DB (which was written by user input), and the plan provides zero guidance on sanitizing or allowlisting redirect destinations.
- **Failure scenario:** Attacker creates a geo route with `bypass_url = "https://evil-phishing.com/steal-creds"`. The QR code is then shared publicly. Any visitor scanning from Vietnam gets silently redirected to the attacker-controlled site. The edge function's redirect path is: `const redirectTarget = matchedRoute?.bypass_url ?? ...` — no schema check, no domain allowlist, no `https://` enforcement. A `javascript:` URI or a `data:` URL could also be stored in `bypass_url TEXT` since the DB column has no constraint.
- **Evidence:** Phase 09, TASK-49: `const redirectTarget = matchedRoute?.bypass_url ?? matchedRoute?.target_url ?? link.default_url; return Response.redirect(redirectTarget, 302);` — no sanitization shown. TASK-47 migration: `ALTER TABLE geo_routes ADD COLUMN bypass_url TEXT;` — no CHECK constraint.
- **Suggested fix:** Add a DB-level CHECK constraint enforcing `https://` prefix on `bypass_url`. Validate URL scheme in the edge function before issuing redirect. Consider an allowlist of permitted destination domains per user account.

---

## Finding 2: click_events Public INSERT Policy — Unlimited Analytics Poisoning

- **Severity:** Critical
- **Location:** Phase 02, TASK-06 "Update RLS Policies" — `click_events` policy
- **Flaw:** The plan explicitly creates `CREATE POLICY "public_insert_clicks" ON click_events FOR INSERT WITH CHECK (true)` — any unauthenticated actor can INSERT arbitrary rows into `click_events` with any `link_id`, including link IDs they do not own.
- **Failure scenario:** An attacker enumerates valid `link_id` UUIDs (sequential or guessable, or via any leak) and bulk-inserts millions of fake click events for a victim's links. The victim sees completely fabricated analytics. Alternatively, an attacker floods the table to exhaust Supabase row limits, driving up the owner's costs. Since there's no rate limiting mentioned anywhere in the plan for click insertion, this is unbounded.
- **Evidence:** Phase 02, TASK-06: `CREATE POLICY "public_insert_clicks" ON click_events FOR INSERT WITH CHECK (true);` with the comment "Edge function insert không cần auth (service role hoặc public)." The plan contradicts itself — TASK-26 says use service role in the edge function, which would make the public INSERT policy unnecessary.
- **Suggested fix:** Remove the public INSERT policy. Use service role exclusively in the edge function (as TASK-26 already plans). The public policy then serves no purpose and only creates an attack surface.

---

## Finding 3: Service Role Key Exposed — Edge Function Can Bypass All RLS

- **Severity:** Critical
- **Location:** Phase 05, TASK-26 "Supabase service role for edge fn"
- **Flaw:** The plan calls for using `SUPABASE_SERVICE_ROLE_KEY` in the edge function to bypass RLS for click insertion. The plan provides no guidance on what operations use the service role client vs. the anon client. If the edge function uses a single service-role client for ALL operations (including reading `qr_links` and `geo_routes`), then the RLS owner-only policies on those tables are completely negated.
- **Failure scenario:** Developer implements a single Supabase client with the service role key in the edge function. The function reads the QR link by short code using this client. An attacker crafts requests with any short code — the service role key bypasses RLS, exposing links belonging to other users (including their `default_url`, `geo_routes`, and metadata). This is a full data exfiltration path via a public endpoint.
- **Evidence:** Phase 05, TASK-26: "Dùng `SUPABASE_SERVICE_ROLE_KEY` env var ... để init client trong edge fn. Đảm bảo click_events INSERT bypass RLS." — the plan does not scope service role usage to INSERT only, leaving it ambiguous and likely to be implemented as a single global client.
- **Suggested fix:** Explicitly document using two clients in the edge function: service-role client only for `click_events` INSERT; anon client (or a scoped query with explicit `user_id` filtering) for reading link/route data.

---

## Finding 4: No Rate Limiting on Redirect Endpoint — QR Code Enumeration

- **Severity:** High
- **Location:** Phase 05, TASK-22–26 (entire hardening phase)
- **Flaw:** The edge function is a fully public endpoint that accepts a short code and queries the database. The plan removes the `ip-api.com` rate-limited call (good) but adds zero rate limiting of its own. With 6-character alphanumeric short codes, the space is small enough to enumerate exhaustively.
- **Failure scenario:** An attacker sends automated requests cycling through all possible `[A-Z0-9]{6}` short codes (2.1 billion combinations, but in practice a targeted subset). Phase 03 TASK-16 adds a 400 for invalid format, but all valid-format codes are still queried against the DB. The attacker harvests all active short codes, their target URLs (revealed via 302 Location header), and owner structure. This leaks the entire URL corpus of all users.
- **Evidence:** Phase 05 adds `Cache-Control: no-store` and bot user-agent filtering, but no IP-based throttling, no CAPTCHA surface, no request rate limiting directive anywhere in the plan.
- **Suggested fix:** Add rate limiting by IP in the edge function (Supabase supports Deno KV for counters, or use Cloudflare rate limiting rules). Return 429 after N requests per IP per minute.

---

## Finding 5: geo_routes RLS — Join-Based Policy Left Undefined

- **Severity:** High
- **Location:** Phase 02, TASK-06 "Update RLS Policies" — geo_routes section
- **Flaw:** The plan says `geo_routes`: "inherit qua link_id (join check)" but provides no SQL for this policy. This is the only table where the owner check requires a join, and the plan explicitly skips implementing it, deferring to the implementer's judgment.
- **Failure scenario:** If the developer forgets to implement the `geo_routes` RLS policy (or implements it incorrectly), User A can read, modify, or delete User B's geo_routes directly via the Supabase client. Since geo_routes contain `target_url` and the new `bypass_url`, this is a direct data access violation. A logged-in attacker can also insert geo_routes with a `link_id` belonging to another user, hijacking their redirect logic.
- **Evidence:** Phase 02, TASK-06: "geo_routes: inherit qua link_id (join check)" — no SQL provided, unlike the complete `qr_links` and `click_events` policies shown in the same section.
- **Suggested fix:** Provide the explicit SQL policy: `CREATE POLICY "owner_geo_routes" ON geo_routes FOR ALL USING (EXISTS (SELECT 1 FROM qr_links WHERE qr_links.id = geo_routes.link_id AND qr_links.user_id = auth.uid()));`

---

## Finding 6: Short Code Collision Retry — Race Condition Creates Duplicate Ownership

- **Severity:** High
- **Location:** Phase 03, TASK-15 "Fix short code collision"
- **Flaw:** The plan proposes a retry loop: "thử insert, nếu bị unique violation thì retry tối đa 5 lần với code mới." This is client-side retry with no atomic uniqueness guarantee. The insert-check-retry cycle has a TOCTOU window.
- **Failure scenario:** Two users simultaneously attempt to create links. Both generate the same short code. Both check the DB (not yet inserted). Both attempt INSERT. One gets the unique violation, retries with a new code. But between retry attempts, the second user's session could be generating identical codes due to the same PRNG seed or entropy source (browser `Math.random()` in Vite context). More critically: the plan acknowledges the "server-side trigger" alternative is better but leaves it as an option. If client-side retry is chosen, a malicious user could time requests to repeatedly collide and exhaust the retry limit (5 attempts), causing `createLinkInDB()` to fail silently or expose the collision error to the frontend with information about existing short codes.
- **Evidence:** Phase 03, TASK-15: "thử insert, nếu bị unique violation thì retry tối đa 5 lần với code mới. Hoặc đơn giản hơn: generate server-side trong Supabase function/trigger (khuyến nghị)" — the recommended path is noted but not mandated, leaving the insecure client-side path as equally valid.
- **Suggested fix:** Mandate server-side generation. Remove the client-side retry option from the plan to prevent implementers from taking the insecure path.

---

## Finding 7: Anon Key Exposed Client-Side — No Supabase Auth Email Confirmation

- **Severity:** High
- **Location:** Phase 02, TASK-08 "AuthPage component" and Phase 08, TASK-43 "Deploy Frontend"
- **Flaw:** The plan deploys `VITE_SUPABASE_ANON_KEY` to Vercel as a public env var (Vite bakes it into the JS bundle). The plan enables Email Auth (TASK-05) but never mentions enforcing email confirmation. With no email confirmation requirement, anyone can register with any email address — including victim email addresses.
- **Failure scenario:** Attacker registers with `victim@company.com`. Supabase creates the account without confirmation. Attacker now has a valid session linked to the victim's email. If the victim later tries to register, they get "email already taken." Attacker can use the account to create links, generate analytics, and impersonate the victim within the system. The anon key being public is expected for Supabase, but combined with open registration and no email verification, account takeover via pre-registration is trivial.
- **Evidence:** Phase 02, TASK-05 only mentions "Enable Email Auth" with no reference to email confirmation settings. Phase 08, TASK-43 sets `VITE_SUPABASE_ANON_KEY` in Vercel with no note about confirming it is a restricted anon key.
- **Suggested fix:** Add a task to enable email confirmation in Supabase Auth settings. Document that the anon key must have appropriate restrictions (no service-role capabilities).

---

## Finding 8: vercel.json Wildcard Rewrite — Security Headers and API Route Exposure

- **Severity:** Medium
- **Location:** Phase 08, TASK-45 "vercel.json — SPA routing"
- **Flaw:** The plan's `vercel.json` uses an unrestricted wildcard rewrite: `"source": "/(.*)", "destination": "/index.html"`. This pattern intercepts ALL paths including `/.env`, `/.git/config`, `/admin`, and any future API routes at the same domain. There are no security headers (CSP, X-Frame-Options, HSTS) defined anywhere in the plan.
- **Failure scenario:** A future developer adds a Vercel serverless function at `/api/webhook` or similar. The wildcard rewrite may interfere with routing unpredictably. More immediately: with no Content-Security-Policy header, the React app is vulnerable to XSS injection via any user-controlled content rendered without sanitization (e.g., link `name` field displayed in the UI). The plan adds no `headers` block to `vercel.json` for security hardening.
- **Evidence:** Phase 08, TASK-45: `{"rewrites": [{"source": "/(.*)", "destination": "/index.html"}]}` — no `headers` section, no CSP, no X-Frame-Options, no HSTS.
- **Suggested fix:** Add a `headers` block to `vercel.json` with at minimum CSP, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, and HSTS.

---

## Finding 9: cf-ipcountry Spoofable — Geo-Routing Bypass

- **Severity:** Medium
- **Location:** Phase 05, TASK-22 "Replace ip-api.com with Cloudflare header"
- **Flaw:** The plan replaces `ip-api.com` with `cf-ipcountry` exclusively. This header is set by Cloudflare's edge network and is reliable in production. However, the plan notes "Nếu `cf-ipcountry` không có (local dev), gracefully fallback về `default_url`" — this fallback means any request that omits or spoofs the `cf-ipcountry` header will bypass geo-routing and hit the default URL directly.
- **Failure scenario:** A user in a country that should be redirected to `bypass_url` (e.g., China, Vietnam — per Phase 09's own example use case) makes a request through any non-Cloudflare proxy or directly to the Supabase edge function URL (which may not go through Cloudflare at all). The `cf-ipcountry` header is absent, so they get `default_url` — entirely defeating the bypass routing that is the core feature of Phase 09. Additionally, since Supabase edge functions are accessible directly via `https://<project>.supabase.co/functions/v1/redirect/`, an attacker from a restricted country can bypass geo-routing by hitting this URL directly without going through Cloudflare.
- **Evidence:** Phase 05, TASK-22: "Nếu `cf-ipcountry` không có (local dev), gracefully fallback về `default_url` thay vì crash." Phase 09's use case explicitly names VN and CN as bypass targets — but direct Supabase function URLs bypass Cloudflare entirely.
- **Suggested fix:** Document that the edge function URL must be proxied through Cloudflare (custom domain with Cloudflare proxy). Add a check that rejects requests where `cf-ipcountry` is absent in production (non-dev environment), or treat missing header as a specific sentinel country.

---

## Finding 10: No Password Reset / Account Recovery Flow

- **Severity:** Medium
- **Location:** Phase 02, TASK-07–08 "AuthContext + AuthPage"
- **Flaw:** The plan implements login and signup but contains zero mention of password reset. Supabase's `resetPasswordForEmail()` sends a magic link to the user's email. Without this, a user who loses their password loses access to all their QR links permanently — there is no recovery path.
- **Failure scenario:** Production user forgets password. No "Forgot password" link exists. User contacts support (if any). All their links — potentially used in printed materials, QR codes already distributed — become inaccessible. An attacker who knows a user's email can repeatedly trigger failed logins without any lockout mechanism (plan has no mention of Supabase Auth rate limiting settings or failed login lockout configuration), effectively performing account enumeration to confirm registered emails.
- **Evidence:** Phase 02, TASK-08 scope: "Form login/signup (toggle giữa 2 mode)" — only two modes, no password reset. No mention of `signIn({ email, type: 'magiclink' })` or `resetPasswordForEmail()` anywhere in the plan.
- **Suggested fix:** Add a task for password reset flow. At minimum, link to Supabase's hosted reset UI. Also document enabling Supabase's built-in brute-force protection settings.

---

## Unresolved Questions

1. Are `link_id` values in `click_events` foreign-key constrained? If not, the public INSERT policy (Finding 2) allows inserting orphan click events with arbitrary UUIDs, which cannot be cleaned up by any owner RLS policy.
2. Does the Supabase project have email confirmation enforced at the project level, independent of this plan's implementation? If yes, Finding 7 is partially mitigated; if no, it is fully exploitable.
3. What is the actual entropy source for short code generation in `db.ts`? `Math.random()` is not cryptographically secure and could produce predictable codes.
4. Will the Supabase edge function URL be behind Cloudflare in production, or is it directly accessible? This determines the exploitability of Finding 9.
