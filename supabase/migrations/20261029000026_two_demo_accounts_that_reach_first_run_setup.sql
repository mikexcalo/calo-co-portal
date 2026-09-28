/*
  The two fixtures backlog #23 has to be verified on.

  Both of them exist because the flow is reached on a fact about the PERSON,
  not about the business: AppShell sends somebody to /welcome while their
  profile has no name, whichever workspace they happen to be looking at. So a
  fixture whose profile already carries a name never gets there by the route a
  real person takes, and the only way to see the screen is to type its address.

  1. Sam Rivera, newstart@example.com, owning Rivera Fit-Out. Created in
     20261029000025 with a name already on the profile, because
     new_auth_user() writes one. Cleared here. Nothing else about the account
     changes, and Rivera Fit-Out stays empty and un-onboarded, which is what
     makes it the brand-new-owner case.

  2. A joiner in Harbor Light Roofing: an invited person arriving at a business
     that was set up long ago. Harbor Light has six customers and an
     onboarded_at, so this is the other half of the flow, the half that had
     been unreachable. They hold no Northwind membership, so
     membership_origin() stamps them 'own' and the studio guards do not apply
     to them.

     Their password is set separately, through the admin API, because that is
     the case being tested: somebody who signs in with a password they know
     must never be asked to pick one. Nothing in SQL should be writing
     encrypted_password.

  Both addresses are under example.com, which RFC 2606 reserves and which
  delivers nowhere.
*/

-- 1. A brand-new owner who has not told us their name.
update public.profiles p
   set full_name = null
  from auth.users u
 where u.id = p.id
   and u.email = 'newstart@example.com';

-- 2. Somebody invited into a business that already runs.
do $$
declare
  uid uuid;
  harbor uuid;
begin
  select id into harbor from public.orgs where slug = 'harbor-light-demo';
  if harbor is null then
    raise exception 'no harbor-light-demo workspace; refusing to invent one';
  end if;

  select id into uid from auth.users where email = 'joiner@example.com';
  if uid is null then
    uid := public.new_auth_user('joiner@example.com', 'Demo joiner');
  end if;

  /* No name on the profile: that is the question they have not answered. */
  update public.profiles
     set full_name = null,
         active_org_id = harbor
   where id = uid;

  insert into public.memberships (org_id, user_id, role)
  values (harbor, uid, 'admin')
  on conflict (org_id, user_id) do update set role = 'admin';
end $$;

/* Both of them must be reachable by the route a person actually takes. */
do $$
declare bad int;
begin
  select count(*) into bad
    from auth.users u
    join public.profiles p on p.id = u.id
   where u.email in ('newstart@example.com', 'joiner@example.com')
     and coalesce(btrim(p.full_name), '') <> '';
  if bad > 0 then
    raise exception '% fixture(s) still carry a name, so the shell will not send them to setup', bad;
  end if;
end $$;
