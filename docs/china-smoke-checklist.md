# China Smoke Checklist

## Goal

Validate that a real China user can open the QR wrapper URL on production and be routed to the configured `bypass_url` path instead of the default target.

## Preconditions

- Production frontend already emits `https://r.worldgate.space/{shortCode}`
- Cloudflare Worker custom domain is live
- `bypass_url` points to the Fly gateway or another approved bypass host
- Tester has a mainland China network or a China-exit VPN

## Create a Production Smoke Link

```bash
npm run smoke:cn -- create --country CN --target-url https://example.com/cn-target --bypass-url https://qrlive-jp-974628.fly.dev/
```

Save the output:

- `scanUrl`
- `linkId`
- `shortCode`
- `verifyCommand`
- `cleanupCommand`

## Tester Steps in China

1. Open `scanUrl` directly in the browser on the China network.
2. Scan the same URL as a QR code on a mobile device if QR scanning is part of the campaign flow.
3. Confirm the final landing host matches the expected bypass host from the create output.
4. Capture evidence:
   - screenshot of the final page
   - final URL shown in the browser
   - local timestamp

## Expected Result

- The wrapper URL is reachable from China.
- The final destination host is the configured `bypass_url` host, for example `qrlive-jp-974628.fly.dev`.
- The user does not fall back to the default target URL.

## Verify Analytics Back in QRLive

Run the verify command from the create output, for example:

```bash
npm run smoke:cn -- verify --link-id <uuid> --expect-country CN
```

Pass criteria:

- `latestClick` exists
- `latestClick.country_code` is `CN`

## Cleanup

After the smoke test is done:

```bash
npm run smoke:cn -- cleanup --link-id <uuid>
```

## Notes

- Do not use `curl -H "cf-ipcountry: CN"` as the primary production smoke test. It does not prove that a real China request reaches the Cloudflare Worker path correctly.
- If `verify` shows `country_code` is empty or not `CN`, treat the smoke as failed even if the tester saw a partial success.
- Replace the sample `target-url` and `bypass-url` with the real campaign URLs before sign-off.
