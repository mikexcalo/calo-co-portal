-- ============================================================================
-- RECORDING AN EVENT
-- ============================================================================
-- Same shape as submit_enquiry: the endpoint is a pipe, and everything that
-- has to be right lives here. A public write path should have as little logic
-- of its own as possible, because logic in the route is logic that has to be
-- correct in two places and only ever gets fixed in one.
--
-- The route knows the address and the user agent. This function knows the
-- salt. Neither alone can build a session key, and the key it produces cannot
-- be reversed or matched across days.
-- ============================================================================

create or replace function public.record_site_event(
  t text,                      -- the site's public write key
  ev text,                     -- view | click | scroll | goal
  p text,                      -- path
  seed text,                   -- address and user agent, from the route
  ref text default null,
  utm jsonb default '{}'::jsonb,
  dev text default null,
  ctry text default null,
  vw integer default null,
  gx integer default null,
  gy integer default null,
  scroll integer default null,
  lbl text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  s record;
  host text;
begin
  -- Unknown or switched-off sites are silently ignored. A public endpoint
  -- should not confirm which tokens are real.
  select id, org_id into s
    from public.client_sites
   where track_token = t and analytics_on
   limit 1;
  if s.id is null then return false; end if;

  if ev not in ('view', 'click', 'scroll', 'goal') then return false; end if;

  /**
   * The referrer is reduced to a host here rather than trusted from the page.
   *
   * A full referring URL carries other people's query strings, and query
   * strings carry reset tokens and email addresses. Throwing the rest away is
   * the only version of this that cannot leak somebody else's data into your
   * analytics table.
   */
  if ref is not null and ref <> '' then
    host := lower(regexp_replace(regexp_replace(ref, '^https?://', ''), '/.*$', ''));
    host := regexp_replace(host, '^www\.', '');
    if host = '' or length(host) > 255 then host := null; end if;
  end if;

  insert into public.site_events (
    site_id, org_id, kind, path, referrer_host,
    utm_source, utm_medium, utm_campaign,
    session_key, device, country, viewport_w, grid_x, grid_y, scroll_pct, label
  )
  values (
    s.id,
    s.org_id,
    ev,
    -- Capped, and query strings never make it this far: the tracker sends
    -- pathname only, and this refuses anything that looks otherwise.
    left(split_part(coalesce(nullif(p, ''), '/'), '?', 1), 512),
    host,
    left(nullif(utm ->> 'source', ''), 120),
    left(nullif(utm ->> 'medium', ''), 120),
    left(nullif(utm ->> 'campaign', ''), 120),
    -- Address and agent, salted per site and per day, one way.
    encode(digest(seed || '|' || s.id::text || '|' || current_date::text, 'sha256'), 'hex'),
    case when dev in ('phone', 'tablet', 'desktop') then dev end,
    left(nullif(ctry, ''), 2),
    vw,
    gx,
    gy,
    case when scroll in (25, 50, 75, 100) then scroll end,
    left(nullif(lbl, ''), 120)
  )
  -- A refresh is not a second visitor. The partial unique index does the work;
  -- this makes the second write a no-op rather than an error the page sees.
  on conflict do nothing;

  return true;
end;
$function$;

revoke all on function public.record_site_event(text, text, text, text, text, jsonb, text, text, integer, integer, integer, integer, text) from public;
grant execute on function public.record_site_event(text, text, text, text, text, jsonb, text, text, integer, integer, integer, integer, text) to anon, authenticated;

comment on function public.record_site_event is
  'Writes one first-party event. The route supplies address and agent; this supplies the salt. Neither alone can build a session key.';
