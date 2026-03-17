# Phase Implementation Report

### Executed Phase
- Phase: Phase 2 — Advanced Analytics (Country Filter + CSV/PDF Export)
- Plan: plans/260317-prod-readiness/
- Status: completed

### Files Modified
- `src/components/StatsPanel.tsx` — +75 lines: country filter Select dropdown, AnalyticsExportButton integration, filterAnalyticsByCountry helper, availableCountries derivation, reset selectedCountry state
- `src/components/StatsCharts.tsx` — +15 lines: selectedCountry prop, countryLabel helper, filter badge on referer section heading

### Files Created
- `src/lib/analytics-export-utils.ts` — 62 lines: generateAnalyticsCSV, triggerCSVDownload, triggerPrintExport
- `src/components/analytics-export-button.tsx` — 48 lines: DropdownMenu with "Tải xuống CSV" + "In PDF" items

### Tasks Completed
- [x] Country filter Select dropdown (shadcn/ui) above charts showing countries present in analytics data
- [x] Default "Tất cả quốc gia" option with frontend filterAnalyticsByCountry logic
- [x] Referer breakdown shows active country badge when a country is filtered
- [x] Quick range preset toggles (7 ngày / 30 ngày / 90 ngày / Tuỳ chọn) — already existed in analytics-date-range-picker.tsx, no change needed
- [x] CSV export — Blob + URL.createObjectURL, UTF-8 BOM for Excel compat, filename `analytics-{shortCode}-{date}.csv`
- [x] PDF export — window.print() via browser
- [x] AnalyticsExportButton with DropdownMenu + Download icon, Vietnamese labels
- [x] analytics-export-utils.ts with all three exported functions
- [x] All text Vietnamese-localized
- [x] Files kept under 200 lines

### Tests Status
- Type check: not run (Bash blocked) — imports verified manually against db.ts barrel, models.ts, types.ts; all shadcn/ui components confirmed present (dropdown-menu.tsx, select.tsx)
- Unit tests: not run
- Integration tests: not run

### Issues Encountered
- Bash access blocked — could not run `npx tsc --noEmit`. Manual import verification performed instead.
- Country filter applies to country_breakdown and scales referer_breakdown proportionally (best-effort) — the RPC does not return per-country referer splits, noted in code comment.
- Bar chart (clicks_by_day) is not filtered per country since the RPC aggregates daily clicks across all countries; filtering on the frontend would require the RPC to return per-country daily data. Current behavior: bar chart always shows total daily clicks for the selected date range regardless of country filter. Country breakdown pie + referer list are filtered.

### Next Steps
- Run `npx tsc --noEmit` and `npm test` to confirm no regressions
- Phase 3 (App.tsx) unblocked — no shared files touched
- If per-country daily clicks are needed, the `get_link_click_detail` RPC would need a `country_code` parameter

### Unresolved Questions
- Should the bar chart also be filtered by country? Requires RPC changes (out of scope for frontend-only phase).
- Should the country filter reset when the date range changes (e.g., selected country has 0 clicks in new range)? Currently it persists and shows empty data gracefully.
