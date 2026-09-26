/*
  Which studio a client workspace belongs to, answered from the data that
  already says so.

  Work in it resolved "the studio" with `kind = 'agency' limit 1`, which is a
  guess dressed as a query. It behaved in the demo only because one account
  owns both agency workspaces; with two real studios a client's request for
  help would be addressed to the wrong one.

  The link already exists and always has: a studio keeps its clients in
  `customers`, and a client workspace is the one with `linked_org_id` pointing
  at it. `orgs_client_reads_its_agency` was already built on exactly this
  shape, so this function is not a new relationship, it is the existing one
  finally being read instead of assumed.

  WHY A FUNCTION AND NOT A QUERY

  Two of the three answers are unreadable from the client's side, by design.
  `memberships_own` returns only your own rows and `profiles_self_select` only
  your own profile, so a client cannot see who owns the studio - which means
  the browser could not write a grant naming them, and the permission the
  client had just ticked was recorded nowhere. It worked in testing for the
  one reason this kind of thing always works in testing: the demo account is
  both sides.

  Definer rights, and a membership check on the caller so it only ever answers
  about a workspace they are standing in. It returns one row per linking
  studio rather than picking: two rows means the data is ambiguous, and the
  product should say so rather than choose somebody's studio for them.
*/

create or replace function public.studio_for(client_org uuid)
returns table (org_id uuid, org_name text, owner_id uuid, owner_name text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (o.id)
    o.id,
    o.name,
    m.user_id,
    p.full_name
  from customers c
  join orgs o on o.id = c.org_id
  left join memberships m on m.org_id = o.id and m.role = 'owner'
  left join profiles p on p.id = m.user_id
  where c.linked_org_id = client_org
    and exists (
      select 1 from memberships caller
      where caller.user_id = auth.uid()
        and caller.org_id = client_org
    )
  order by o.id, m.created_at
$$;

revoke all on function public.studio_for(uuid) from public;
grant execute on function public.studio_for(uuid) to authenticated;

comment on function public.studio_for(uuid) is
  'The studio or studios whose customer record links to this workspace. One row each: the caller decides, and more than one means the data is ambiguous, not that one of them is right. Only answers for a workspace the caller belongs to.';
