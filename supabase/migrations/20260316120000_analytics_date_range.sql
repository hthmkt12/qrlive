-- Add get_link_click_detail_v2 RPC with date range filtering
-- Keeps total_clicks and today_clicks as all-time counts (unfiltered)
-- Filters clicks_by_day, country_breakdown, referer_breakdown by date range

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
language sql
stable
security invoker
set search_path = public
as $$
  with owned_link as (
    select qr_links.id
    from public.qr_links
    where qr_links.user_id = auth.uid()
      and qr_links.id = p_link_id
  ),
  link_clicks as (
    select click_events.*
    from public.click_events
    join owned_link on owned_link.id = click_events.link_id
  ),
  -- all-time totals (not filtered by date range)
  totals as (
    select
      owned_link.id as link_id,
      count(link_clicks.id)::bigint as total_clicks,
      count(*) filter (where link_clicks.created_at >= current_date)::bigint as today_clicks,
      count(distinct nullif(link_clicks.country_code, ''))::bigint as countries_count
    from owned_link
    left join link_clicks on link_clicks.link_id = owned_link.id
    group by owned_link.id
  ),
  day_series as (
    select generate_series(p_start_date, p_end_date, interval '1 day')::date as day
  ),
  -- clicks_by_day filtered by p_start_date..p_end_date
  clicks_by_day as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'date', to_char(day_series.day, 'YYYY-MM-DD'),
          'clicks', coalesce(day_counts.clicks, 0)
        )
        order by day_series.day
      ),
      '[]'::jsonb
    ) as value
    from day_series
    left join (
      select
        click_events.created_at::date as day,
        count(*)::bigint as clicks
      from link_clicks as click_events
      where click_events.created_at::date between p_start_date and p_end_date
      group by click_events.created_at::date
    ) as day_counts on day_counts.day = day_series.day
  ),
  -- country_breakdown filtered by date range
  country_breakdown as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'country_code', ranked.country_code,
          'clicks', ranked.clicks
        )
        order by ranked.clicks desc, ranked.country_code
      ),
      '[]'::jsonb
    ) as value
    from (
      select
        click_events.country_code,
        count(*)::bigint as clicks
      from link_clicks as click_events
      where coalesce(click_events.country_code, '') <> ''
        and click_events.created_at::date between p_start_date and p_end_date
      group by click_events.country_code
    ) as ranked
  ),
  -- referer_breakdown filtered by date range
  referer_breakdown as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'referer', ranked.referer,
          'clicks', ranked.clicks
        )
        order by ranked.clicks desc, ranked.referer
      ),
      '[]'::jsonb
    ) as value
    from (
      select
        coalesce(nullif(click_events.referer, ''), 'direct') as referer,
        count(*)::bigint as clicks
      from link_clicks as click_events
      where click_events.created_at::date between p_start_date and p_end_date
      group by coalesce(nullif(click_events.referer, ''), 'direct')
    ) as ranked
  )
  select
    totals.link_id,
    totals.total_clicks,
    totals.today_clicks,
    totals.countries_count,
    clicks_by_day.value,
    country_breakdown.value,
    referer_breakdown.value
  from totals
  cross join clicks_by_day
  cross join country_breakdown
  cross join referer_breakdown;
$$;

grant execute on function public.get_link_click_detail_v2(uuid, date, date) to authenticated;
