/*
  The client owns their workspace. The studio keeps everything it works with.

  Backlog #12. In every client workspace the studio held `owner` and the
  client held `admin`, which is backwards: the studio needed `owner` when
  `owner` was the only role that could do anything, and what actually carries
  the studio's access today is a standing grant the client can take back.

  WHAT `owner` IS LOAD-BEARING FOR, checked before anything moved:

    Almost everywhere, `owner` and `admin` are the same thing - the test is
    `role in ('owner','admin')`. That is true of the orgs update policy, the
    commercial-columns guard, the invite route, Overheads' usage tile,
    client_usage, and every setup item. So moving a client from admin to
    owner grants them nothing in any of those places.

    Exactly four things ask for `owner` alone, and all four are "who is the
    senior person here", not "what may they do":
      - studio_for()        names the studio's owner
      - doc-owner.ts        whose name signs a customer-facing document
      - who-to-tell.ts      who hears when a customer accepts
      - setup.ts, two items both also platformOnly, gated on the slug

  WHAT OWNERSHIP MUST NOT CARRY, and does not:

    Modules and plan are `orgs_guard_commercial_columns`, which allows the
    workspace's own owner/admin only when `self_serve_modules` is true, and
    otherwise only an owner/admin of the agency found through
    `customers.workspace_id`. Ownership alone changes nothing there.

    Studio-level screens are unreachable because `modulesFor` keys them on
    the org's kind, and other workspaces are unreachable because reach is
    `memberships` plus `current_org_id()`. Neither reads the role.

  ORDER: promote, then demote. Two owners for a moment is safe; zero owners
  is a workspace nobody can administer.

  DEMO ONLY. Real workspaces are listed for a decision and not touched.
*/

set local search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- 1. The one thing ownership does add: the client can show the studio out.
--
-- SECURITY DEFINER and deliberately narrow, because `memberships` has RLS
-- with a single SELECT policy and no write path at all - the right shape for
-- this is one function that does one thing, not a policy that opens the
-- table. It removes only memberships stamped `studio`, only from a workspace
-- the caller owns as its own person, and it closes the grants on the way out
-- so a revoked studio cannot keep editing under a standing grant.
-- ---------------------------------------------------------------------------
create or replace function public.remove_studio(workspace uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  gone integer;
begin
  if auth.uid() is null then
    raise exception 'Nothing was saved. You are not signed in.'
      using errcode = 'insufficient_privilege';
  end if;

  /* The caller has to be this workspace's own owner. A studio holding owner
     must not be able to remove another studio, and an admin must not be able
     to do this at all: it ends an arrangement somebody is paying for. */
  if not exists (
    select 1 from memberships m
     where m.user_id = auth.uid()
       and m.org_id = workspace
       and m.role = 'owner'
       and m.origin = 'own'
  ) then
    raise exception
      'Nothing was saved. Only this workspace''s owner can remove the studio.'
      using errcode = 'insufficient_privilege';
  end if;

  update work_grants
     set revoked_at = now()
   where org_id = workspace
     and revoked_at is null;

  delete from memberships
   where org_id = workspace
     and origin = 'studio';

  get diagnostics gone = row_count;
  return gone;
end;
$$;

revoke all on function public.remove_studio(uuid) from public;
grant execute on function public.remove_studio(uuid) to authenticated;

comment on function public.remove_studio(uuid) is
  'Ends the studio arrangement on one workspace: revokes every live work grant and removes every membership stamped studio. Callable only by that workspace''s own owner. The one power ownership adds.';

-- ---------------------------------------------------------------------------
-- 2. The rep demo workspace was linked one way and not the other.
--
-- `membership_origin()` reads customers.linked_org_id and the commercial
-- guard reads customers.workspace_id, and 20261029000017 set only the first.
-- So Coastline's membership stamped `own` when it should be `studio`, and
-- the guard found no agency and fell through to allowing module changes from
-- inside. Both halves of the link, so both behave.
-- ---------------------------------------------------------------------------
update customers
   set workspace_id = linked_org_id
 where linked_org_id = (select id from orgs where slug = 'coastline-rep-demo')
   and workspace_id is null;

update memberships
   set origin = 'studio'
 where org_id = (select id from orgs where slug = 'coastline-rep-demo')
   and user_id = (select id from auth.users where email = 'mikexcalo+demo@gmail.com');

-- ---------------------------------------------------------------------------
-- 3. The demo had no client to hand a workspace to.
--
-- One account held owner of all six workspaces, so "the client" and "the
-- studio" were the same person and nothing about this could be tested. Harbor
-- Light gets its own person, created through new_auth_user because a
-- hand-written insert into auth.users leaves four token columns NULL and
-- breaks password reset.
-- ---------------------------------------------------------------------------
do $$
declare
  hlr    uuid;
  studio uuid;
  client uuid;
begin
  select id into hlr from orgs where slug = 'harbor-light-demo';
  select id into studio from auth.users where email = 'mikexcalo+demo@gmail.com';
  if hlr is null or studio is null then
    raise notice 'demo not present; nothing to do';
    return;
  end if;

  select id into client from auth.users where email = 'mikexcalo+harbor@gmail.com';
  if client is null then
    perform public.new_auth_user('mikexcalo+harbor@gmail.com', 'Dana Okonkwo (demo client)');
    select id into client from auth.users where email = 'mikexcalo+harbor@gmail.com';
  end if;

  /* Promote first. Two owners for a moment is safe; zero is a workspace
     nobody can administer, and it is one failed statement away if the order
     is reversed. origin stamps itself to 'own': this person is a member of
     no org that links to Harbor Light. */
  insert into memberships (user_id, org_id, role)
  values (client, hlr, 'owner')
  on conflict (user_id, org_id) do update set role = 'owner';

  insert into profiles (id, full_name, active_org_id, role)
  values (client, 'Dana Okonkwo (demo client)', hlr, 'admin')
  on conflict (id) do update set active_org_id = excluded.active_org_id;

  /* Then demote. The studio keeps its membership, which is how it opens the
     workspace at all; the standing grant is what lets it change anything. */
  update memberships
     set role = 'member'
   where user_id = studio and org_id = hlr;

  raise notice 'harbor client %, studio demoted', client;
end $$;
