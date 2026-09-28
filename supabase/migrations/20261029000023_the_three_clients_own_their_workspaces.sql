/*
  Backlog #12, on the three real client workspaces.

  Lakemere Services, Mammoth Construction and Global Seafood Partners. In each
  one the studio held `owner` and the person whose business it is held
  `admin`, which is backwards: the studio needed `owner` when `owner` was the
  only role that could do anything, and what carries its access today is a
  standing grant the client can take back.

  Approved after the demo run and after the audit that found the one real
  blocker: `self_serve_modules` was true on Lakemere, which would have handed
  Marcie the module switchboard along with ownership. Cleared in
  20261029000019, checked as her before and after.

  WHAT EACH CLIENT GAINS: exactly one thing, the ability to remove the studio.
  Every other check in the product asks `role in ('owner','admin')`, so
  ownership adds nothing to what they could already do as admin.

  WHAT THE STUDIO KEEPS: its membership, which is how it opens the workspace
  at all; its standing grant, which is what lets it change anything (all three
  are can_edit true, can_send false, and untouched here); View mode, the
  change log and Get help, none of which read the role.

  WHAT CHANGES FOR THE CLIENT'S CUSTOMERS: the name on a proposal or an
  invoice. `doc-owner.ts` names the org's `owner`, so their documents stop
  saying the studio's name and start saying theirs. That is the point, and it
  is the most visible thing here.

  ORDER: promote every client first, then demote the studio. Two owners for a
  moment is safe. Zero owners is a workspace nobody can administer, and it is
  one failed statement away if the order is reversed. The check at the end
  refuses to leave any workspace ownerless.
*/

do $$
declare
  ws        record;
  studio    uuid;
  promoted  int := 0;
  demoted   int := 0;
begin
  select id into studio from auth.users where email = 'mikexcalo@gmail.com';
  if studio is null then
    raise exception 'no studio account; refusing to touch anything';
  end if;

  -- 1. Promote. Every client, before any demotion anywhere.
  for ws in
    select o.id, o.name
      from orgs o
     where o.is_demo = false
       and o.name in ('Lakemere Services', 'Mammoth Construction', 'Global Seafood Partners')
  loop
    update memberships
       set role = 'owner'
     where org_id = ws.id
       and origin = 'own'
       and role <> 'owner';
    promoted := promoted + 1;

    /* Never demote into a workspace with nobody to run it. */
    if not exists (
      select 1 from memberships
       where org_id = ws.id and origin = 'own' and role = 'owner'
    ) then
      raise exception
        '% has no own-side owner after promotion; refusing to demote the studio', ws.name;
    end if;
  end loop;

  -- 2. Demote, only now.
  for ws in
    select o.id, o.name
      from orgs o
     where o.is_demo = false
       and o.name in ('Lakemere Services', 'Mammoth Construction', 'Global Seafood Partners')
  loop
    update memberships
       set role = 'member'
     where org_id = ws.id
       and origin = 'studio'
       and role = 'owner';
    demoted := demoted + 1;
  end loop;

  raise notice 'promoted in %, demoted in %', promoted, demoted;
end $$;

/*
  The last word, as a constraint rather than a hope: every one of the three
  has exactly one owner, and that owner is the business's own person.
*/
do $$
declare bad int;
begin
  select count(*) into bad
    from orgs o
   where o.is_demo = false
     and o.name in ('Lakemere Services', 'Mammoth Construction', 'Global Seafood Partners')
     and (
       (select count(*) from memberships m
         where m.org_id = o.id and m.role = 'owner' and m.origin = 'own') <> 1
       or exists (select 1 from memberships m
                   where m.org_id = o.id and m.role = 'owner' and m.origin = 'studio')
     );
  if bad > 0 then
    raise exception '% workspace(s) did not end up with exactly one own-side owner', bad;
  end if;
end $$;
