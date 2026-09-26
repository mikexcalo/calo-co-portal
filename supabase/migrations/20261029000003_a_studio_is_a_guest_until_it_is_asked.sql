/*
  Closing the hole the last brief left open, and named.

  guard_session_writes() only fires when somebody has declared a mode. Declare
  nothing and there is nothing to hold you to: the studio owner writes as an
  ordinary member, because that is exactly what RLS sees.

  Now the membership itself is the declaration. A 'studio' member is a guest
  in the workspace, and a guest changes nothing without a live grant - whether
  they entered Work in it or simply started typing. The client's own team is
  untouched: no session, no grant needed, nothing about their day changes.

  NOT YET ON FOR REAL WORKSPACES.

  Switching this on for a workspace with no standing grant locks the studio
  out of work it does every day. Which real workspaces get a standing grant is
  the owner's call, not this migration's, so the rule is gated on the demo
  flag until that answer exists. `studio_rule_applies` is the whole gate: the
  follow-up migration replaces its body with `true` and issues the grants in
  the same breath.
*/

create or replace function public.studio_rule_applies(workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select o.is_demo from public.orgs o where o.id = workspace), false);
$$;

comment on function public.studio_rule_applies(uuid) is
  'Whether the studio-is-a-guest rule is switched on for this workspace. Demo only for now; becomes `true` once the owner has decided which real workspaces get a standing grant.';

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
  guest      boolean;
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

  /* Is there a live grant? Asked once, because both branches below want it,
     and asked now rather than when the page loaded. */
  select exists (
    select 1 from public.work_grants g
    where g.org_id = target_org
      and g.granted_to = auth.uid()
      and g.revoked_at is null
      and g.ended_at is null
  ) into ok;

  select * into live
  from public.work_sessions s
  where s.user_id = auth.uid()
    and s.org_id = target_org
    and s.ended_at is null
  order by s.started_at desc
  limit 1;

  if found then
    if live.mode = 'view' then
      raise exception
        'Nothing was saved. View mode cannot change anything. Leave View mode to make this change.';
    end if;

    /* Work in it: a live grant, checked now rather than when the page loaded. */
    if not ok then
      raise exception
        'Nothing was saved. That work session has ended or been taken back. Ask them to let you back in.';
    end if;

    return coalesce(new, old);
  end if;

  /*
    No session declared. That used to be the end of it.

    A studio member declaring nothing is the bypass this replaces - they are
    in somebody else's workspace either way, and saying nothing was the one
    route that skipped every check.
  */
  select (m.origin = 'studio') into guest
  from public.memberships m
  where m.user_id = auth.uid()
    and m.org_id = target_org;

  if coalesce(guest, false) and public.studio_rule_applies(target_org) and not ok then
    raise exception
      'Nothing was saved. This is their workspace and you are in it as their studio. They have to let you work in it first.';
  end if;

  return coalesce(new, old);
end;
$$;

comment on function public.guard_session_writes() is
  'Refuses writes made in View mode, writes made in a work session with no live grant, and writes by a studio member who has no live grant at all. The client''s own team and the service role are unaffected.';

/*
  The demo, set up so both answers can be seen.

  Harbor Light runs on a standing grant, which is the shape a real client
  workspace is meant to have. Tideline and Ember & Ash have none, so the
  refusal is a thing you can go and look at rather than a claim in a commit
  message.
*/
do $$
declare
  demo_user uuid;
  harbor    uuid;
begin
  select id into harbor from public.orgs where name = 'Harbor Light Roofing' and is_demo;
  select m.user_id into demo_user
    from public.memberships m
    join public.orgs o on o.id = m.org_id
   where o.name = 'Northwind Studio' and m.role = 'owner'
   limit 1;

  if harbor is null or demo_user is null then
    return;
  end if;

  update public.work_grants
     set ended_at = now()
   where org_id = harbor and granted_to = demo_user
     and ended_at is null and revoked_at is null and not standing;

  if not exists (
    select 1 from public.work_grants
     where org_id = harbor and granted_to = demo_user
       and standing and revoked_at is null and ended_at is null
  ) then
    insert into public.work_grants (org_id, granted_to, can_edit, can_send, standing)
    values (harbor, demo_user, true, true, true);
  end if;
end $$;
