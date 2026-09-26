/*
  Harbor Light's standing grant, restored.

  Taken back by hand while checking that the client's Revoke button really
  does reach the database. It does. This puts the demo back to the state the
  brief describes: Harbor Light runs on a standing grant, Tideline and Ember &
  Ash have none, so both answers are there to look at.
*/
do $$
declare demo_user uuid; harbor uuid;
begin
  select id into harbor from public.orgs where name = 'Harbor Light Roofing' and is_demo;
  select m.user_id into demo_user
    from public.memberships m join public.orgs o on o.id = m.org_id
   where o.name = 'Northwind Studio' and m.role = 'owner' limit 1;
  if harbor is null or demo_user is null then return; end if;

  if not exists (
    select 1 from public.work_grants
     where org_id = harbor and granted_to = demo_user
       and standing and revoked_at is null and ended_at is null
  ) then
    insert into public.work_grants (org_id, granted_to, can_edit, can_send, standing)
    values (harbor, demo_user, true, true, true);
  end if;
end $$;
