/*
  "Are they using it?" could not be answered at all.

  access_events has exactly one policy, `user_id = auth.uid()`, so the studio
  owner can read their own page loads and nobody else's. Every line of that
  card — last signed in, used this week, never opened — came back empty, and
  would have gone on coming back empty however the screen was written.

  The data is there. The permission was not.

  This is a deliberate widening and worth naming as such: the studio can now
  learn WHEN a client last used the software and WHICH parts they opened. It
  cannot learn anything else from this. No emails, no individual rows, no
  paths carrying record ids — only the first segment of a path, which is the
  module, and a timestamp.

  The incremental exposure is small. The agency already holds an owner
  membership in every client workspace it set up, so it can already read the
  client's jobs, invoices and customers. What it could not read was the
  activity log, and an agency that cannot tell whether the thing it installed
  is being used cannot do its job.

  Scoped three ways:

    the caller must be an owner or admin
    of an org of kind 'agency'
    that has a customers row whose linked_org_id is the workspace being asked
    about

  So it answers for a client the studio actually set up, and returns null for
  anything else — including a workspace the caller merely belongs to. Blank Co
  is the demo's example of that: a member of it, not a client of it, so the
  card simply does not appear.

  SECURITY DEFINER because the whole point is to see past a policy, and
  search_path is pinned so the definer's rights cannot be aimed at a table of
  somebody else's choosing.
*/

create or replace function public.client_usage(p_org uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  allowed boolean;
  result jsonb;
begin
  if p_org is null or auth.uid() is null then
    return null;
  end if;

  select exists (
    select 1
      from public.customers c
      join public.orgs a       on a.id = c.org_id and a.kind = 'agency'
      join public.memberships m on m.org_id = a.id and m.user_id = auth.uid()
     where c.linked_org_id = p_org
       and m.role in ('owner', 'admin')
  ) into allowed;

  if not allowed then
    return null;
  end if;

  /*
    Their loads, not yours.

    The studio owner opening a client's workspace writes access_events rows of
    its own, and counting those as use would make every client look active the
    moment somebody went to check whether they were.
  */
  select jsonb_build_object(
    'last_at', (
      select max(at) from public.access_events
       where org_id = p_org and user_id <> auth.uid()
    ),
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object('section', s.section, 'last_at', s.last_at)
                       order by s.last_at desc)
        from (
          select nullif(split_part(ltrim(path, '/'), '/', 1), '') as section,
                 max(at) as last_at
            from public.access_events
           where org_id = p_org
             and user_id <> auth.uid()
             and path is not null
           group by 1
        ) s
       where s.section is not null
    ), '[]'::jsonb)
  ) into result;

  return result;
end
$$;

revoke all on function public.client_usage(uuid) from public;
grant execute on function public.client_usage(uuid) to authenticated;

comment on function public.client_usage(uuid) is
  'Aggregate activity for a workspace the calling agency set up. Null for anything else. No emails, no rows, no record ids.';
