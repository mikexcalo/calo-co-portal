-- ============================================================================
-- WHO ACTUALLY SHOWED UP
-- ============================================================================
-- First-party, which is the whole point. The alternative is a third party that
-- charges per event, needs a cookie banner, and gets blocked by a third of
-- browsers before it ever counts anybody.
--
-- COOKIELESS ON PURPOSE
--
-- A session is a daily hash of address, user agent and a per-site salt. It is
-- enough to tell one visit from ten, and it cannot be reversed into a person
-- or joined across days, which is why no banner is required and no consent has
-- to be collected. Nothing here is a profile of anybody.
--
-- The salt rotates with the date, so yesterday's hashes cannot be matched to
-- today's even by us. That is a deliberate ceiling on what this can become.
--
-- WHAT IT IS NOT
--
-- Not a session recorder. Storing every mouse movement is a lot of money for
-- insight that is stale in a week. Clicks land on a grid and scrolls land on
-- quarters, which answers the only question anybody really has: does anyone
-- get as far as the part that asks them to buy.
-- ============================================================================

/**
 * The site's public write key.
 *
 * Separate from every other token because it is the one that ships inside a
 * script tag on a public page. It can write events for one site and read
 * nothing at all, so leaking it costs you junk rows and no data.
 */
alter table public.client_sites
  add column if not exists track_token text unique;

update public.client_sites
   set track_token = encode(gen_random_bytes(16), 'hex')
 where track_token is null;

comment on column public.client_sites.track_token is
  'Public write key, shipped in the page. Writes events for this site and reads nothing: leaking it costs junk rows, not data.';

/** Off by default. A site should not be measured until somebody says so. */
alter table public.client_sites
  add column if not exists analytics_on boolean not null default false;

-- ---------------------------------------------------------------------------
-- The events.
-- ---------------------------------------------------------------------------

create table if not exists public.site_events (
  id bigserial primary key,
  site_id uuid not null references client_sites(id) on delete cascade,
  org_id uuid not null references orgs(id) on delete cascade,

  kind text not null check (kind in ('view', 'click', 'scroll', 'goal')),

  /** Path only. A full URL carries query strings, and query strings carry
      email addresses, order numbers and reset tokens people paste around. */
  path text not null,

  /** Where they came from, reduced to a host. Keeping the full referring URL
      is how one site's analytics leaks another site's private paths. */
  referrer_host text,

  utm_source text,
  utm_medium text,
  utm_campaign text,

  /** Daily, salted, one-way. See the note at the top. */
  session_key text not null,

  device text check (device in ('phone', 'tablet', 'desktop')),
  country text,

  /** Clicks, bucketed to a grid at write time rather than stored precisely.
      Precision here has no use and every use it does have is surveillance. */
  grid_x integer,
  grid_y integer,
  /** So a click at the same grid cell means the same thing on a phone and a
      30 inch monitor. */
  viewport_w integer,

  /** 25, 50, 75, 100. Quarters, not pixels. */
  scroll_pct integer check (scroll_pct in (25, 50, 75, 100)),

  /** What was clicked, when it is worth naming. A button, not a coordinate. */
  label text,

  created_at timestamptz not null default now(),

  /**
   * The day, fixed to UTC and stored.
   *
   * created_at::date cannot be indexed: casting timestamptz to date reads the
   * session's TimeZone, so the same row means different days to different
   * connections and Postgres refuses it. Pinning to UTC makes it a fact about
   * the row rather than about whoever is asking, which is also the only way a
   * once-per-day rule can mean anything.
   */
  day date not null generated always as (((created_at at time zone 'UTC'))::date) stored
);

create index if not exists site_events_site_time_idx
  on public.site_events(site_id, created_at desc);

create index if not exists site_events_path_idx
  on public.site_events(site_id, kind, path);

/**
 * One row per session per path per day, for the view count.
 *
 * Without this, a visitor who refreshes eleven times is eleven visitors, and
 * every number on the screen is wrong in the flattering direction.
 */
create unique index if not exists site_events_one_view_per_session
  on public.site_events(site_id, session_key, path, day)
  where kind = 'view';

comment on table public.site_events is
  'First-party traffic. Cookieless, path-only, coordinates bucketed. Not a session recorder and deliberately cannot become one.';

-- ---------------------------------------------------------------------------
-- Tenancy.
--
-- Reading is org-scoped like everything else. Writing does not happen through
-- here at all: the tracker posts to a route that checks the site token and
-- uses the service key, so there is no policy that lets the public insert.
-- ---------------------------------------------------------------------------

alter table public.site_events enable row level security;

drop policy if exists site_events_read on public.site_events;
create policy site_events_read on public.site_events
  for select using (org_id = public.current_org_id());

-- ---------------------------------------------------------------------------
-- What the screen actually reads.
--
-- A day at a time, computed in the database. The alternative is shipping
-- 40,000 rows to a browser so it can count them.
-- ---------------------------------------------------------------------------

create or replace view public.site_traffic_daily as
select e.site_id,
       e.org_id,
       e.day,
       count(*) filter (where e.kind = 'view')               as views,
       count(distinct e.session_key)                         as visitors,
       count(*) filter (where e.kind = 'click')              as clicks,
       count(*) filter (where e.kind = 'goal')               as goals,
       count(distinct e.session_key) filter (
         where e.kind = 'scroll' and e.scroll_pct >= 75
       )                                                     as read_to_end
  from public.site_events e
 group by e.site_id, e.org_id, e.day;

comment on view public.site_traffic_daily is
  'A day per row. Visitors are distinct sessions, not views: the difference is the entire honesty of the number.';

/**
 * Where they came from, over the last 30 days.
 *
 * Only the entry view counts. Counting the referrer on every pageview makes
 * one visitor who read six pages look like six arrivals from Google.
 */
create or replace view public.site_sources_30d as
select e.site_id,
       e.org_id,
       coalesce(e.utm_source, e.referrer_host, 'direct') as source,
       count(distinct e.session_key)                     as visitors
  from public.site_events e
 where e.kind = 'view'
   and e.created_at > now() - interval '30 days'
 group by e.site_id, e.org_id, coalesce(e.utm_source, e.referrer_host, 'direct');

create or replace view public.site_pages_30d as
select e.site_id,
       e.org_id,
       e.path,
       count(*) filter (where e.kind = 'view')  as views,
       count(distinct e.session_key)            as visitors,
       count(*) filter (where e.kind = 'click') as clicks
  from public.site_events e
 where e.created_at > now() - interval '30 days'
 group by e.site_id, e.org_id, e.path;
