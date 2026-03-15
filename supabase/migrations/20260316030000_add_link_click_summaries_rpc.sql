create or replace function public.get_link_click_summaries(p_link_ids uuid[])
returns table (
  link_id uuid,
  total_clicks bigint,
  today_clicks bigint,
  top_country_code text
)
language sql
stable
security invoker
set search_path = public
as $$
  with owned_links as (
    select qr_links.id
    from public.qr_links
    where qr_links.user_id = auth.uid()
      and (p_link_ids is null or qr_links.id = any(p_link_ids))
  ),
  click_totals as (
    select
      owned_links.id as link_id,
      count(click_events.id)::bigint as total_clicks,
      count(*) filter (where click_events.created_at >= current_date)::bigint as today_clicks
    from owned_links
    left join public.click_events on click_events.link_id = owned_links.id
    group by owned_links.id
  ),
  top_countries as (
    select ranked.link_id, ranked.country_code as top_country_code
    from (
      select
        click_events.link_id,
        click_events.country_code,
        row_number() over (
          partition by click_events.link_id
          order by count(*) desc, click_events.country_code
        ) as rank
      from public.click_events
      join owned_links on owned_links.id = click_events.link_id
      where coalesce(click_events.country_code, '') <> ''
      group by click_events.link_id, click_events.country_code
    ) as ranked
    where ranked.rank = 1
  )
  select
    click_totals.link_id,
    click_totals.total_clicks,
    click_totals.today_clicks,
    top_countries.top_country_code
  from click_totals
  left join top_countries on top_countries.link_id = click_totals.link_id
  order by click_totals.link_id;
$$;

grant execute on function public.get_link_click_summaries(uuid[]) to authenticated;
