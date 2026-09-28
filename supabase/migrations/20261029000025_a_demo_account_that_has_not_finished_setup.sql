/*
  Somewhere to stand while looking at the first-run flow.

  /welcome could not be inspected. Signed out it redirects to /login; signed
  in it calls router.replace('/') the moment it sees `onboarded_at`, and every
  account in the project was onboarded. So the first screen a new client ever
  sees was the one screen nobody could open.

  This is a demo account and a demo workspace that genuinely have not finished
  setup: `onboarded_at` null, and no jobs, customers, invoices or anything
  else, because the flow checks for real work and stamps itself done rather
  than asking a working business to introduce itself.

  The address is @example.com, which is reserved by RFC 2606 and delivers
  nowhere. `postEmail` refuses reserved addresses outright, so nothing this
  account does can reach a person.

  Made with new_auth_user because a hand-written insert into auth.users leaves
  four token columns NULL and breaks password reset for that account.
*/

set local search_path = public, extensions;

do $$
declare
  uid uuid;
  org uuid := gen_random_uuid();
begin
  if exists (select 1 from public.orgs where slug = 'rivera-demo') then
    raise notice 'already there';
    return;
  end if;

  select id into uid from auth.users where email = 'newstart@example.com';
  if uid is null then
    perform public.new_auth_user('newstart@example.com', 'Sam Rivera');
    select id into uid from auth.users where email = 'newstart@example.com';
  end if;

  /* onboarded_at deliberately null: that is the whole point of this row. */
  insert into public.orgs (id, name, slug, kind, is_demo)
  values (org, 'Rivera Fit-Out', 'rivera-demo', 'contractor', true);

  insert into public.memberships (user_id, org_id, role) values (uid, org, 'owner');

  insert into public.profiles (id, full_name, active_org_id)
  values (uid, 'Sam Rivera', org)
  on conflict (id) do update set active_org_id = excluded.active_org_id;

  raise notice 'unfinished demo: user % org %', uid, org;
end $$;
