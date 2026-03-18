# CN Evidence Sign-Off Review

**Date**: 2026-03-18  
**Reviewer**: code-reviewer

---

## 1. Is the current CN evidence sufficient for sign-off?

**No.** The current evidence is insufficient to sign off the production flow from mainland China.

### What we have

| Evidence | Proves | Sufficient? |
|----------|--------|-------------|
| VN smoke test (302 → `qrlive-jp-proxy.fly.dev`) | Redirect logic, geo matching, analytics recording work correctly from Vietnam | ✅ For VN |
| chinafirewalltest.com screenshot | `r.worldgate.space` domain is **reachable** from CN probes | Partial |

### What is missing

| Gap | Why it matters |
|-----|----------------|
| No real CN short-code click | Reachability ≠ redirect works. The chinafirewalltest.com check only proves DNS/TCP connectivity. It does not prove that the Cloudflare Worker → Supabase Edge Function → geo-route → bypass_url chain executes correctly when hit from a CN IP. |
| No CN analytics record | The checklist explicitly requires `country_code = CN` in `click_events` to pass. Without it, we cannot confirm Cloudflare forwards `cf-ipcountry: CN` correctly for real CN traffic. |
| No CN tester landing page evidence | No screenshot or URL confirmation that a real CN browser landed on the bypass destination. |

---

## 2. Minimum exact evidence still required

One successful round-trip from a mainland-China network:

1. A **real CN click** on a short-code URL like `https://r.worldgate.space/{shortCode}` that produces a `302` redirect to the configured `bypass_url` host.
2. The **analytics record** in `click_events` with `country_code = CN` for that click.
3. *(Nice-to-have)* A browser screenshot from the CN tester confirming the final landing page URL matches the bypass host.

---

## 3. Acceptance procedure for the CN tester

### Pre-step (run from dev machine, not China)
```bash
npm run smoke:cn -- create --country CN --bypass-url https://qrlive-jp-proxy.fly.dev/
```
Save the `scanUrl`, `linkId`, `verifyCommand`, and `cleanupCommand` from the output.

### Step 1 — Open from China
Open the `scanUrl` (e.g., `https://r.worldgate.space/CNXXXXXX`) in a browser on a mainland-China network. Confirm the browser lands on `qrlive-jp-proxy.fly.dev`. Take a screenshot of the final URL bar.

### Step 2 — Verify analytics (from dev machine)
```bash
npm run smoke:cn -- verify --link-id <uuid> --expect-country CN
```
Pass criteria: exit code 0, `matchesExpectedCountry: true`, `country_code: CN`.

### Step 3 — Cleanup (from dev machine)
```bash
npm run smoke:cn -- cleanup --link-id <uuid>
```

If Step 2 passes → **sign off**.  
If Step 2 shows `country_code` is empty or not `CN` → **fail**, even if the tester saw the bypass page.

---

## Unresolved Questions

None.
