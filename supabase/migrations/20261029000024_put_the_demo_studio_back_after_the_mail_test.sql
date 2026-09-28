/*
  The demo studio, back after the mail test.

  The third and last removal: this one was run against production so the
  notice would go out with a real mail key behind it, and it did - "Harbor
  Light Roofing removed you from their workspace", delivered to the demo
  studio's own address. Nothing about it touched a real client workspace or
  anybody's browser session.

  Same shape as before: member, not owner, and a standing grant that can send.
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

  if not exists (select 1 from work_grants where org_id = hlr and revoked_at is null and ended_at is null) then
    insert into work_grants (org_id, granted_to, granted_by, can_edit, can_send, standing)
    values (hlr, studio, null, true, true, true);
  end if;
end $$;
