/*
  The demo studio, back again after the second run.

  The removal was exercised twice: once to prove it works from the client's
  own screen, and once more to watch the notice to the studio resolve its
  recipient. Both left Harbor Light with no studio, which is not the state the
  rest of the demo assumes.

  Same shape as 20261029000021: member, not owner, and a standing grant that
  can send. Written again rather than made re-runnable, because a migration
  that puts data back is a record of something that happened, and two of them
  is the honest count.
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
    insert into work_grants (org_id, granted_to, granted_by, can_send, standing)
    values (hlr, studio, null, true, true);
  end if;
end $$;
