/*
  The client could not see the control that is theirs.

  `RemoveStudio` decided whether to draw itself by counting memberships
  stamped `studio` on the workspace. From a browser that count is always
  zero: `memberships` has one policy, `memberships_own`, which is
  `user_id = auth.uid()` and SELECT only, so the only membership row anybody
  can read is their own. The client's own row is `own`, so the card hid
  itself from the one person it exists for.

  Found by signing in as the demo client rather than by reading the code,
  which is the whole reason for having a client to sign in as.

  The fix is not a wider policy. Who else holds a membership here is not the
  client's business in general; whether a studio is present, and whether they
  personally may show it out, is. So it is one function answering exactly that
  question, with the same test `remove_studio` applies, so the button and the
  refusal cannot drift apart.
*/

create or replace function public.may_remove_studio(workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1 from memberships m
       where m.user_id = auth.uid()
         and m.org_id = workspace
         and m.role = 'owner'
         and m.origin = 'own'
    )
    and exists (
      select 1 from memberships s
       where s.org_id = workspace
         and s.origin = 'studio'
    );
$$;

revoke all on function public.may_remove_studio(uuid) from public;
grant execute on function public.may_remove_studio(uuid) to authenticated;

comment on function public.may_remove_studio(uuid) is
  'Whether the caller may end the studio arrangement on this workspace: they are its own owner, and a studio is actually present. The same test remove_studio applies, so the control and the refusal cannot disagree.';
