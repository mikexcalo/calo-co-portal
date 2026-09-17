-- Who walked in.
--
-- Mike sent Marcie a link and had no way to find out whether she opened it.
-- Supabase records last_sign_in_at, which answers "has this person ever been
-- here" and nothing else — not when, not how often, not what they looked at.
--
-- Two decisions worth knowing:
--
--  * Identity is never sent by the caller. record_access reads auth.uid() off
--    the verified token, so the browser supplies only a path. A client that
--    lies about who it is gets its own id written down anyway.
--  * first_today is computed BEFORE the insert. Computed after, the row just
--    written is itself evidence of a previous visit and every arrival looks
--    like a repeat.
--
-- The day boundary is Portland's, not UTC. Somebody signing in at 8pm Eastern
-- should not count as tomorrow morning.

create table if not exists access_events (
  id       bigserial primary key,
  user_id  uuid not null references auth.users(id) on delete cascade,
  org_id   uuid references orgs(id) on delete set null,
  email    text,
  path     text not null,
  at       timestamptz not null default now()
);

create index if not exists access_events_user_at on access_events (user_id, at desc);
create index if not exists access_events_at      on access_events (at desc);

alter table access_events enable row level security;

-- Deliberately narrow. This table is read by Mike through the SQL editor or
-- the service role, never through the anon key. A client can see their own
-- footprints and nobody else's, which is the least surprising thing to be
-- true if anyone ever goes looking.
drop policy if exists access_events_own on access_events;
create policy access_events_own on access_events
  for select using (user_id = auth.uid());

create or replace function record_access(p_path text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user  uuid := auth.uid();
  v_email text;
  v_org   uuid;
  v_org_name text;
  v_first boolean;
  v_count int;
  v_day   timestamptz;
begin
  -- Not signed in is not an error. Public token pages call this too.
  if v_user is null then
    return jsonb_build_object('recorded', false);
  end if;

  select email into v_email from auth.users where id = v_user;

  -- The org comes from the profile, not the request, for the same reason the
  -- user id does.
  select active_org_id into v_org from profiles where id = v_user;
  select name into v_org_name from orgs where id = v_org;

  v_day := (date_trunc('day', now() at time zone 'America/New_York'))
             at time zone 'America/New_York';

  select not exists (
    select 1 from access_events
     where user_id = v_user
       and at >= v_day
  ) into v_first;

  insert into access_events (user_id, org_id, email, path)
  values (v_user, v_org, v_email, left(coalesce(p_path, '/'), 200));

  select count(*) into v_count
    from access_events
   where user_id = v_user and at >= v_day;

  return jsonb_build_object(
    'recorded',    true,
    'first_today', v_first,
    'email',       v_email,
    'org',         v_org_name,
    'today_count', v_count
  );
end;
$$;

revoke all on function record_access(text) from public;
grant execute on function record_access(text) to authenticated;

-- What Mike actually reads. One row per person per day, so a week of activity
-- is seven short lines rather than four hundred page views.
create or replace view access_by_day as
select
  (at at time zone 'America/New_York')::date as on_date,
  email,
  max(at)   as last_seen,
  min(at)   as first_seen,
  count(*)  as page_views,
  count(distinct path) as screens
from access_events
group by 1, 2
order by 1 desc, 3 desc;
