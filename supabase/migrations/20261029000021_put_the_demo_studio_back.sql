/*
  The demo studio, put back after the removal was proved end to end.

  Harbor Light's client removed Northwind from their own Security screen,
  which is the thing that needed proving. Leaving it removed would leave the
  demo without the arrangement every other part of it assumes: no Get help,
  no View mode, no change log, and a studio that cannot open one of its own
  clients.

  The membership goes back as `member`, not `owner` - #12's shape - and a
  fresh standing grant with the same terms as the one the removal revoked.
*/
do $$
declare
  hlr    uuid;
  studio uuid;
begin
  select id into hlr from orgs where slug = 'harbor-light-demo';
  select id into studio from auth.users where email = 'mikexcalo+demo@gmail.com';
  if hlr is null or studio is null then return; end if;

  insert into memberships (user_id, org_id, role)
  values (studio, hlr, 'member')
  on conflict (user_id, org_id) do update set role = 'member';

  if not exists (select 1 from work_grants where org_id = hlr and revoked_at is null) then
    /* granted_to is a person, not an org: it references auth.users, and it is
       NOT NULL because a grant with nobody on the other end is not a grant. */
    insert into work_grants (org_id, granted_to, granted_by, can_send, standing)
    values (hlr, studio, null, true, true);
  end if;
end $$;
