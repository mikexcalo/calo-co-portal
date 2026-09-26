/*
  Making the two modes real.

  View mode and Work in it were enforced entirely in the browser: a module
  variable in readonly.ts, a Proxy around the Supabase client, and a patched
  fetch. Every one of those is the customer's own code running on the
  customer's own machine, so the honest description was always "this stops the
  product writing, not the person". Anybody who opened dev tools, or called
  PostgREST with their own token, wrote whatever they liked.

  The reason that was hard to fix is that the database could not tell the two
  apart. The studio owner holds an `owner` membership in every client
  workspace it set up, so "Mike looking" and "Mike working" are the same
  Postgres role with the same rights. Nothing in a row says which one is
  happening.

  So the mode becomes a fact the server holds, not a boolean the browser
  remembers.

    work_sessions   one row per time somebody enters a mode, ended on exit
    guard_session_writes()  a trigger that reads it and refuses

  WHAT THIS DOES AND DOES NOT BUY

  A write from anywhere - the app, curl, the SQL editor under a user token -
  now goes through the trigger. View mode refuses all of them. Work in it
  refuses any that are not covered by a live work_grant, so revoking a grant
  stops writes on the next statement rather than the next page load.

  It is still not a wall against somebody determined: the app opens the
  session, so the same person could end their own session row and write
  freely. That is deliberate and it is the honest limit. The difference is
  that doing so is now a recorded act against a row somebody can read, rather
  than a boolean nobody can see. Narrowing the studio's own membership below
  `owner` is the thing that would close it, and it is its own brief.

  The service role bypasses all of this, which is correct: the API routes that
  run as the platform are not a person acting inside somebody's workspace.
*/

create table if not exists public.work_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  org_id     uuid not null references public.orgs(id) on delete cascade,
  mode       text not null check (mode in ('view', 'work')),
  /* Which grant a work session is leaning on. Null for view. */
  grant_id   uuid references public.work_grants(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at   timestamptz
);

create index if not exists work_sessions_live
  on public.work_sessions (user_id, org_id) where ended_at is null;

alter table public.work_sessions enable row level security;

/*
  You may open your own session and close your own session. You may not
  delete one, and you may not touch anybody else's.

  No delete policy at all, which is the point: the record of having been in
  View mode cannot be tidied away afterwards, only ended.
*/
create policy work_sessions_open on public.work_sessions
  for insert with check (user_id = auth.uid());

create policy work_sessions_read on public.work_sessions
  for select using (user_id = auth.uid());

create policy work_sessions_close on public.work_sessions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

/*
  The guard itself.

  Runs BEFORE every insert, update and delete on the tables that hold a
  business's work. Reads the caller's live session for the row's own org, and
  raises with a sentence rather than a code, because human() passes a
  well-written message through untouched.
*/
create or replace function public.guard_session_writes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_org uuid;
  live       record;
  ok         boolean;
begin
  /* The platform acting as itself. API routes using the service role are not
     a person standing in somebody's workspace. */
  if auth.uid() is null then
    return coalesce(new, old);
  end if;

  target_org := coalesce(
    (to_jsonb(coalesce(new, old)) ->> 'org_id')::uuid,
    null
  );
  if target_org is null then
    return coalesce(new, old);
  end if;

  select * into live
  from public.work_sessions s
  where s.user_id = auth.uid()
    and s.org_id = target_org
    and s.ended_at is null
  order by s.started_at desc
  limit 1;

  if not found then
    return coalesce(new, old);
  end if;

  if live.mode = 'view' then
    raise exception
      'Nothing was saved. View mode cannot change anything. Leave View mode to make this change.';
  end if;

  /* Work in it: a live grant, checked now rather than when the page loaded. */
  select exists (
    select 1 from public.work_grants g
    where g.org_id = target_org
      and g.granted_to = auth.uid()
      and g.revoked_at is null
      and g.ended_at is null
  ) into ok;

  if not ok then
    raise exception
      'Nothing was saved. That work session has ended or been taken back. Ask them to let you back in.';
  end if;

  return coalesce(new, old);
end;
$$;

comment on function public.guard_session_writes() is
  'Refuses writes made while the caller has a live view-mode session on the row''s workspace, and writes made in a work session with no live grant. The service role is exempt: it is the platform, not a person.';

/*
  Attached to the tables that hold a business's work.

  Deliberately not every table with an org_id. work_sessions and work_grants
  are excluded or entering and leaving a mode would be refused by the mode
  itself; work_changes is the log the guard's own bookkeeping writes;
  notifications and feedback are read receipts and messages rather than
  changes to anybody's business, which is the same list readonly.ts already
  calls NOT_A_CHANGE.
*/
do $$
declare
  t text;
begin
  foreach t in array array[
    'case_studies','case_study_claims','client_products','client_sites','costs',
    'customer_contacts','customer_notes','customer_terms','customers','discovery',
    'documents','drops','estimates','import_batches','job_invoices','job_tasks',
    'jobs','links','pitches','price_items','proposal_terms','qr_campaigns',
    'rate_tiers','reference_docs','reminders','review_requests','saved_views',
    'seo_citations','seo_profile','seo_tasks','setup_items','site_change_requests',
    'site_content','site_requests','site_sections','targets','time_entries'
  ]
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_session_guard', t);
    execute format(
      'create trigger %I before insert or update or delete on public.%I
       for each row execute function public.guard_session_writes()',
      t || '_session_guard', t
    );
  end loop;
end $$;
