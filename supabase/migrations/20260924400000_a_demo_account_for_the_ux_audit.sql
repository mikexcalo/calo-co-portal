-- A demo login and two workspaces, for a UX audit.
--
-- Data and accounts only. Nothing here changes how the product behaves for
-- anybody else: no schema changes, no policy changes, no new code paths. Two
-- new orgs, one new user, and rows underneath them.
--
-- THE PASSWORD IS NOT SET HERE, BY ANYONE.
--
-- encrypted_password is a bcrypt hash of a fresh uuid that is generated
-- inside this statement and never stored, printed or returned. Nobody knows
-- it, including me. The account is reachable only by pressing "Forgot
-- password" on the sign-in screen, which mails a link to the address below —
-- an address Mike controls. That is deliberate: a credential I chose would be
-- a credential I had seen.
--
-- email_confirmed_at is set so the reset flow will send. Without it Supabase
-- treats the address as unverified and the link never arrives.

set local search_path = public, extensions;

do $$
declare
  uid  uuid := gen_random_uuid();
  hlr  uuid := gen_random_uuid();   -- Harbor Light Roofing
  blank uuid := gen_random_uuid();  -- Blank Co
begin
  if exists (select 1 from auth.users where email = 'mikexcalo+demo@gmail.com') then
    raise notice 'demo user already exists, nothing done';
    return;
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
  ) values (
    '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    'mikexcalo+demo@gmail.com',
    crypt(gen_random_uuid()::text, gen_salt('bf')),   -- unknowable, never recorded
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Demo (UX audit)"}'::jsonb
  );

  -- GoTrue needs the identity row or the account cannot sign in at all.
  insert into auth.identities (
    provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    uid::text, uid,
    jsonb_build_object('sub', uid::text, 'email', 'mikexcalo+demo@gmail.com', 'email_verified', true),
    'email', now(), now(), now()
  );

  -- ---------------------------------------------------------------------
  -- The two workspaces.
  --
  -- is_demo is a label in this product and not a boundary — the isolation
  -- comes from memberships and current_org_id(), the same as every real
  -- workspace. It is set because the switcher shows it, so whoever is
  -- auditing can never mistake these for live businesses.
  -- ---------------------------------------------------------------------
  insert into public.orgs (id, name, slug, kind, is_demo, default_labor_rate, onboarding_path, onboarded_at)
  values (hlr, 'Harbor Light Roofing', 'harbor-light-demo', 'contractor', true, 95.00, 'whole', now());

  insert into public.orgs (id, name, slug, kind, is_demo)
  values (blank, 'Blank Co', 'blank-co-demo', 'contractor', true);

  insert into public.memberships (user_id, org_id, role) values (uid, hlr, 'owner');
  insert into public.memberships (user_id, org_id, role) values (uid, blank, 'owner');

  insert into public.profiles (id, full_name, active_org_id, role)
  values (uid, 'Demo (UX audit)', hlr, 'owner');

  raise notice 'demo user %, harbor %, blank %', uid, hlr, blank;
end $$;
