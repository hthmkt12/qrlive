# Code Review: QRLive Production Readiness (Phases 1-5)

**Date:** 2026-03-17
**Reviewer:** code-reviewer
**Scope:** 8 commits (8063d59..e942de1), ~2,660 LOC added across 54 files
**Build status:** TypeScript clean, ESLint clean (1 pre-existing warning), 308/308 tests pass

---

## Overall Assessment

Solid implementation across all five phases. Code is well-structured, follows existing patterns, stays under 200-line file limits, and has comprehensive test coverage. Security posture improved significantly (leaked key removed, Sentry DSN safe). A few medium-priority issues around CSV injection, error handling, and edge cases documented below.

---

## CRITICAL

None found.

---

## HIGH

### H1. CSV Injection via formula-prefix fields (bulk import/export)
**File:** `src/lib/analytics-export-utils.ts:29`, `src/lib/bulk-operations-utils.ts:125-130`
**Issue:** Country names from user-controlled `COUNTRIES` list are safe, but referer strings and link names are user-controlled. A malicious referer like `=CMD("calc")` or `+1+1` will be written directly into CSV cells. When opened in Excel/Google Sheets, these can execute formulas.
**Impact:** Potential code execution on the machine of whoever opens the exported CSV.
**Fix:** Prefix any cell starting with `=`, `+`, `-`, `@`, `\t`, `\r` with a single quote `'` or tab character in both `escapeCSVField()` and the analytics CSV builder. Example:
```ts
function escapeCSVField(value: string): string {
  let safe = value;
  if (/^[=+\-@\t\r]/.test(safe)) {
    safe = "'" + safe; // neutralize formula injection
  }
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}
```
The analytics export (`generateAnalyticsCSV`) also needs the same treatment for `referer` values at line 38-39.

### H2. Bulk import has no file size / row count limit
**File:** `src/components/bulk-import-dialog.tsx:52-65`
**Issue:** `processFile` reads entire file into memory via `FileReader.readAsText`. A 100MB CSV would freeze the browser tab. No row-count cap either, so a CSV with 10k links would fire 10k sequential Supabase inserts.
**Fix:**
- Add file size check before reading (e.g., 1MB max)
- Add row count cap (e.g., 500 rows max) after parsing
- Consider batching bulk create (e.g., 10 concurrent inserts via `Promise.all` with chunking)

### H3. Bulk create is sequential - no rate limiting or abort capability
**File:** `src/hooks/use-link-mutations.ts:158-178`
**Issue:** Each link created one-by-one with `for` loop. If user uploads 200 links and closes dialog midway, the mutation continues running in background with no abort signal. Also no exponential backoff on failures.
**Fix:** Accept an `AbortSignal`, check `signal.aborted` between iterations. Consider parallel batches of 5-10 for throughput.

---

## MEDIUM

### M1. QR logoUrl is not validated/sanitized
**File:** `src/components/QRPreview.tsx:62,134`, `src/lib/db/models.ts:7`
**Issue:** `logoUrl` is a free-form string stored in JSONB and rendered as `<img src>` inside the QR SVG via `qrcode.react`'s `imageSettings.src`. While XSS risk is low (React escapes attributes), a `javascript:` URL would be harmless in `<image>` but a data URI with huge payload could bloat the stored config. No URL validation on the schema side.
**Fix:** Add URL validation (must start with `https://`) in the QrConfig schema or at the component level before persisting.

### M2. `filterAnalyticsByCountry` proportional scaling is misleading
**File:** `src/components/StatsPanel.tsx:69-91`
**Issue:** Referer breakdown is scaled proportionally by country click ratio. This is documented as "best-effort" but could mislead users into thinking the referer data is per-country when it's not. No UI indication that this is an approximation.
**Fix:** Add a subtle tooltip/note like "Ước tính" (Estimated) next to referer section when country filter is active. Already has `activeCountryLabel` badge in StatsCharts.tsx which is good, but should mention it's estimated.

### M3. `downloadCSV` in bulk-operations-utils missing BOM for UTF-8
**File:** `src/lib/bulk-operations-utils.ts:167-177`
**Issue:** Unlike `triggerCSVDownload` in analytics-export-utils.ts (which prepends `\uFEFF` BOM), the bulk export's `downloadCSV` function does NOT add a BOM. Vietnamese text in link names will show garbled in Excel without BOM.
**Fix:** Add `"\uFEFF" +` prefix to the Blob content, matching the analytics export pattern.

### M4. Sentry replay config may capture sensitive data
**File:** `src/lib/sentry-config.ts:17`
**Issue:** `maskAllText: false, blockAllMedia: false` means Sentry Session Replay will capture all visible text including passwords typed into the password fields, link URLs, and analytics data. This is a privacy concern.
**Fix:** Set `maskAllText: true` or at minimum use `maskAllInputs: true` to mask form inputs. Or add `data-sentry-mask` attributes to sensitive elements.

### M5. Cloudflare Worker CORS allows all origins
**File:** `cloudflare-worker/redirect-proxy.js:91`
**Issue:** `Access-Control-Allow-Origin: *` is acceptable for a redirect proxy but should be documented as intentional. Since this worker handles password-protected links via POST, open CORS could enable cross-origin password brute-force (though rate-limiting exists on the Supabase edge function side).
**Fix:** Document this is intentional. Consider restricting to the known frontend domain if possible, or rely on the edge function's rate limiting.

### M6. `aggregateWeekly` can crash on empty clicks_by_day
**File:** `src/components/StatsPanel.tsx:49-58`
**Issue:** If `rawAnalytics.clicks_by_day` is empty, `slice[0].date` at line 53 throws. While unlikely (RPC should return at least the date range), defensive coding is warranted.
**Fix:** Add `if (days.length === 0) return [];` at the top.

### M7. EditLinkDialog password semantics are ambiguous
**File:** `src/components/EditLinkDialog.tsx:77-83`
**Issue:** Empty string `linkPassword` is passed as `password` to `updateLink.mutateAsync`. The mutation treats `""` as "clear password" and `undefined` as "no change". But if user opens edit dialog and doesn't touch the password field, `""` (the defaultValue from `reset`) will clear an existing password unintentionally.
**Reality check:** Looking at line 53, `linkPassword` defaults to `""` in `reset()`. So every save clears the password unless user types a new one. This seems like a bug.
**Fix:** Use `undefined` as default for `linkPassword`, and only pass it when the user explicitly interacts with the field. Or use a separate "clear password" checkbox.

---

## LOW

### L1. `qrConfigRef.current` never used in CreateLinkDialog
**File:** `src/components/CreateLinkDialog.tsx:22,65`
**Issue:** `qrConfigRef` is initialized and passed to `createLink.mutateAsync`, but `QRPreview` is not rendered in CreateLinkDialog — the comment says "if rendered in a future step". So `qrConfig` is always `null`. Not harmful, just dead code.
**Fix:** Remove if QRPreview won't be added to create flow. Keep if planned.

### L2. Cloudflare worker test uses `afterEach` without import
**File:** `cloudflare-worker/redirect-proxy.test.js:78`
**Issue:** `afterEach` is used but only `describe, it, expect, vi, beforeEach` are imported from vitest at line 1. Works because vitest exposes globals, but inconsistent with the explicit import style.
**Fix:** Add `afterEach` to the import.

### L3. StatsPanel.tsx is 219 lines - close to 200 line limit
**File:** `src/components/StatsPanel.tsx`
**Issue:** At 219 lines, slightly over the project's 200-line target. The utility functions (`toISODate`, `defaultDateRange`, `formatDayLabel`, `aggregateWeekly`, `rangeDays`, `filterAnalyticsByCountry`) could be extracted.
**Fix:** Extract utility functions to `src/lib/analytics-utils.ts` if file grows further.

### L4. Hardcoded error level cast in QRPreview
**File:** `src/components/QRPreview.tsx:60`
**Issue:** `(qrConfig?.errorLevel as ErrorLevel)` — the cast is safe because QrConfig defines `errorLevel?: "L" | "M" | "Q" | "H"` matching `ErrorLevel`, but the cast is redundant since the types already match.
**Fix:** Remove the `as ErrorLevel` cast.

---

## Edge Cases Found by Scouting

1. **Bulk import with duplicate short codes in same CSV:** If CSV contains two rows with the same `custom_short_code`, the second will fail with `SHORT_CODE_TAKEN` after the first succeeds. This is handled gracefully (error reported per-link), but user may not expect partial import.

2. **QR config stored in JSONB is not schema-validated on read:** If someone manually edits the DB and puts invalid data in `qr_config`, the frontend will consume it without validation. Low risk but worth noting.

3. **`groupRowsIntoLinks` uses name+short_code as key:** If two rows have the same name but different URLs, the second URL is silently dropped (first one wins). Could lead to data loss if user intended different links.

4. **Cloudflare worker `extractShortCode` accepts any string, no format validation:** Unlike the edge function which validates `^[A-Z0-9_-]{3,20}$`, the proxy forwards any path segment. Supabase edge function handles validation, so this is defense-in-depth issue only.

---

## Positive Observations

- Clean separation: schemas, utils, components each have clear boundaries
- Lazy loading for StatsPanel/Recharts is good for initial load performance
- Sentry integration is properly conditional (no-ops without DSN)
- Cloudflare worker is well-documented with JSDoc and comprehensive tests
- Bulk import has excellent UX: drag-drop, preview table, progress bar, error summary
- CSV parsing handles quoted fields with embedded commas correctly
- Security incident (leaked anon key) was addressed immediately in commit 8063d59
- All 308 tests pass; no type errors; minimal lint warnings

---

## Metrics

| Metric | Value |
|--------|-------|
| TypeScript errors | 0 |
| ESLint errors | 0 |
| ESLint warnings | 1 (pre-existing) |
| Tests passing | 308/308 |
| Files over 200 LOC | 1 (StatsPanel: 219) |
| New files added | ~15 |

---

## Recommended Actions (Priority Order)

1. **Fix M7** (password clearing bug in EditLinkDialog) - user data loss risk
2. **Fix H1** (CSV injection) - security
3. **Fix H2** (file size / row count limits for bulk import) - DoS protection
4. **Fix M3** (add BOM to bulk export CSV) - user-facing bug for Vietnamese content
5. **Fix M4** (Sentry replay masking) - privacy
6. **Fix M6** (empty array guard in aggregateWeekly) - crash prevention
7. Address H3, M1, M2, M5 as time permits

---

## Unresolved Questions

1. **M7 confirmation needed:** Is the password-clearing-on-every-save behavior in EditLinkDialog intentional? The `reset` sets `linkPassword: ""` which maps to "clear password" in the mutation. This needs product confirmation.
2. **Bulk import concurrency:** Should bulk create use parallel inserts for throughput, or is sequential preferred for predictable ordering and rate-limit safety?
3. **QR config migration:** The migration adds `qr_config JSONB DEFAULT NULL`. Is there an RLS policy update needed for this column, or does the existing row-level policy on `qr_links` cover it?
