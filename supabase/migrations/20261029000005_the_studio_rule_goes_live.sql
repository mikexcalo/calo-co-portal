/*
  Switching the studio-is-a-guest rule on for real workspaces, and handing
  out the standing grants in the same breath so nobody is locked out.

  The order inside one migration matters more than it looks. Flipping the gate
  without the grants would make CALO&CO read-only in three workspaces it runs
  every day, between one statement and the next. Both happen together or
  neither does.

  Approved after review of every real membership:

    Lakemere Services        Mike  owner  studio  -> standing grant
    Mammoth Construction     Mike  owner  studio  -> standing grant
    Global Seafood Partners  Mike  owner  studio  -> standing grant

  can_send is false on all three. A grant with no end that can also mail a
  client's customers is a bigger thing than "do not break my day to day", and
  sending still works the loud way, through Work in it, where the client is
  told.

  The client's own people - Marcie, Mark, John - are 'own' and unaffected.
  CALO&CO itself is unaffected: nothing links to it, so everybody in it is
  'own' and the rule never applies there.
*/

create or replace function public.studio_rule_applies(workspace uuid)
returns boolean
language sql
immutable
set search_path = public
as $$
  /*
    On everywhere now.

    Kept as a function rather than deleted. It is the one place the rule can
    be switched off in a hurry, and a named switch somebody can find beats an
    emergency migration that drops triggers off 37 tables.
  */
  select true;
$$;

comment on function public.studio_rule_applies(uuid) is
  'Whether the studio-is-a-guest rule is on for this workspace. On everywhere since 26 Sept 2026. The one switch, if it ever has to come off.';

/*
  A standing grant for every studio membership outside the demo.

  Written as a loop over `origin = 'studio'` rather than three hard-coded
  names, because the failure worth avoiding is a workspace that exists and was
  missed. The three above are what this matches today; a fourth client set up
  tomorrow gets one by the same rule rather than by somebody remembering.
*/
do $$
declare
  m record;
  n int := 0;
begin
  for m in
    select mm.user_id, mm.org_id
    from public.memberships mm
    join public.orgs o on o.id = mm.org_id
    where mm.origin = 'studio'
      and not coalesce(o.is_demo, false)
  loop
    if not exists (
      select 1 from public.work_grants g
      where g.org_id = m.org_id
        and g.granted_to = m.user_id
        and g.standing
        and g.revoked_at is null
        and g.ended_at is null
    ) then
      insert into public.work_grants (org_id, granted_to, can_edit, can_send, standing)
      values (m.org_id, m.user_id, true, false, true);
      n := n + 1;
    end if;
  end loop;

  raise notice 'standing grants issued: %', n;
end $$;

/*
  Testing belongs in the demo.

  "Test Account (Mammoth view)" was a second sign-in made to see Mammoth as
  somebody who is not the owner. That is what the demo workspaces are for, and
  a real client's member list is not the place to keep a spare key.

  Checked before removing: it owns nothing. No job, note, invoice, estimate,
  receipt, time entry or document anywhere in the database carries its id -
  every uuid column in public was scanned. Only the membership and the profile
  row reference it, so this takes nothing with it.

  The account itself is left alone rather than deleted. Deleting an auth user
  is the one thing here that cannot be undone, and it now belongs to no
  workspace, which is the part that mattered.
*/
delete from public.memberships
where user_id = '8c1cdee1-8b07-447e-9562-7fef33a32c48'
  and org_id = (select id from public.orgs where name = 'Mammoth Construction');
