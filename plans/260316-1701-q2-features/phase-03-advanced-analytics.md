# Phase 03: Advanced Analytics -- Date Range Filtering

## Context Links
- [StatsPanel](../../src/components/StatsPanel.tsx)
- [Analytics Detail RPC](../../supabase/migrations/20260316033000_add_link_click_detail_rpc.sql)
- [Queries](../../src/lib/db/queries.ts)
- [Hooks](../../src/hooks/use-links.ts)

## Overview
- **Priority:** P2
- **Status:** Pending
- **Effort:** 3h
- Add date range filtering to analytics. Currently hardcoded to 7 days. Allow user to select custom range.

## Key Insights
- `get_link_click_detail` RPC currently hardcodes `current_date - 6` for 7-day window
- Need new RPC version that accepts `p_start_date` and `p_end_date` params
- Keep existing 7-day as default; user selects preset ranges (7d, 30d, 90d, custom)
- Existing `click_events.created_at` index supports date filtering efficiently

## Requirements

### Functional
- StatsPanel shows date range selector (preset: 7 ngay, 30 ngay, 90 ngay, Tuy chon)
- Custom range uses two DatePickers (start, end)
- Bar chart adjusts to selected range (daily for <30d, weekly for 30-90d)
- Country and referer breakdowns filter by selected range
- Summary cards (total, today) remain all-time/today (not filtered)

### Non-Functional
- RPC performance: date range filtering uses existing index
- No new tables or columns needed
- No new npm packages (shadcn Calendar/Popover already available)

## Architecture

### Data Flow
```
User selects date range in StatsPanel
  -> Hook passes start_date/end_date to query
  -> RPC get_link_click_detail_v2(link_id, start_date, end_date)
  -> Returns filtered clicks_by_day, country_breakdown, referer_breakdown
  -> StatsPanel renders filtered data
```

## DB Migration

**File:** `supabase/migrations/YYYYMMDDHHMMSS_add_analytics_date_range_rpc.sql`

New RPC `get_link_click_detail_v2` with date params. Keep old RPC for backward compat (summaries still use it).

```sql
create or replace function public.get_link_click_detail_v2(
  p_link_id uuid,
  p_start_date date default current_date - 6,
  p_end_date date default current_date
)
returns table (
  link_id uuid,
  total_clicks bigint,
  today_clicks bigint,
  countries_count bigint,
  clicks_by_day jsonb,
  country_breakdown jsonb,
  referer_breakdown jsonb
)
language sql stable security invoker set search_path = public
as $$
  -- Same structure as get_link_click_detail but:
  -- 1. day_series uses p_start_date..p_end_date
  -- 2. clicks_by_day WHERE uses p_start_date
  -- 3. country_breakdown and referer_breakdown filter by date range
  -- total_clicks and today_clicks remain unfiltered (all-time)
$$;

grant execute on function public.get_link_click_detail_v2(uuid, date, date) to authenticated;
```

## Related Code Files

### Files to Modify
| File | Change |
|------|--------|
| `src/lib/db/queries.ts` | New `fetchLinkAnalyticsDetailV2(linkId, startDate, endDate)` |
| `src/lib/db/models.ts` | No change (same return shape) |
| `src/lib/query-keys.ts` | Add date range to analytics detail key |
| `src/hooks/use-links.ts` | Update `useLinkAnalyticsDetail` to accept date range |
| `src/components/StatsPanel.tsx` | Add date range selector UI |

### New Files
| File | Purpose |
|------|---------|
| `src/components/analytics-date-range-picker.tsx` | Date range selector component (presets + custom) |

## Implementation Steps

1. **Create migration** with `get_link_click_detail_v2` RPC
2. **Run migration** locally
3. **Update `queries.ts`**: Add `fetchLinkAnalyticsDetailV2` calling new RPC
4. **Update `query-keys.ts`**: Include startDate/endDate in detail key for cache separation
   ```typescript
   detail: (id: string, start?: string, end?: string) =>
     ["links", "analytics", "detail", id, start ?? "default", end ?? "default"] as const,
   ```
5. **Update `use-links.ts`**: `useLinkAnalyticsDetail` accepts optional `{ startDate, endDate }`
6. **Create `analytics-date-range-picker.tsx`**:
   - Preset buttons: 7 ngay, 30 ngay, 90 ngay
   - "Tuy chon" opens two Calendar popovers
   - Emits `{ startDate: string, endDate: string }`
7. **Update `StatsPanel.tsx`**:
   - Add date range state (default: 7d)
   - Render `AnalyticsDateRangePicker` above charts
   - Pass dates to hook
   - Adjust bar chart: if range >30d, group by week (aggregate in JS)
8. **Run typecheck and lint**
9. **Write tests**: Query key generation with dates

## Todo List

- [ ] 3.1 Create DB migration with `get_link_click_detail_v2`
- [ ] 3.2 Add `fetchLinkAnalyticsDetailV2` to `queries.ts`
- [ ] 3.3 Update `query-keys.ts` with date params
- [ ] 3.4 Update `useLinkAnalyticsDetail` hook
- [ ] 3.5 Create `analytics-date-range-picker.tsx`
- [ ] 3.6 Update `StatsPanel.tsx` with date range selector
- [ ] 3.7 Write tests
- [ ] 3.8 Run typecheck and lint

## Success Criteria

- [ ] Default view shows 7-day data (same as current behavior)
- [ ] Selecting 30d/90d shows expanded date range
- [ ] Custom date range works with Calendar picker
- [ ] Bar chart groups by week for ranges >30 days
- [ ] Country and referer breakdowns filter by selected range
- [ ] Summary cards remain all-time (not filtered by range)
- [ ] Cache keys separate per date range (no stale data)
- [ ] All existing tests pass

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Large date ranges slow RPC | `click_events.created_at` index exists; 90d max range is manageable |
| RPC function duplication | v2 replaces v1 logic; can deprecate v1 later once stable |
| Weekly aggregation complexity | Simple JS `reduce` in StatsPanel -- no server-side change needed |

## Security Considerations
- RPC uses `security invoker` -- respects RLS (user can only see own link analytics)
- Date params are SQL `date` type -- no injection risk
- No new auth requirements
