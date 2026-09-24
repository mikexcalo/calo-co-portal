-- Password reset failed for the demo account. I broke it when I created it.
--
-- auth.users has eight varchar token columns. Four carry a default of '':
--   email_change_token_current, phone_change, phone_change_token,
--   reauthentication_token
-- Four carry no default at all:
--   confirmation_token, recovery_token, email_change, email_change_token_new
--
-- My INSERT named none of the eight. The four with defaults got ''. The four
-- without got NULL.
--
-- GoTrue, the auth service, is Go. It reads those columns into plain string
-- fields rather than nullable ones, so a NULL cannot be scanned and the
-- lookup errors before it reaches the part that sends an email. The sign-in
-- page catches the failure and says "That did not work", which is true and
-- tells you nothing.
--
-- Checked every account: all five real users have '' in all four. This was
-- only ever the one row I hand-wrote, so reset was never broken for anybody
-- real.
--
-- The obvious root-cause fix is to give those four columns the '' default the
-- other four already have. That is not available: auth is Supabase's schema
-- and we are not its owner, so ALTER TABLE auth.users is refused.
--
-- What is available is to stop hand-writing the INSERT. new_auth_user below
-- is the only sanctioned way to create an account outside the signup flow. It
-- names every column GoTrue reads, so the failure cannot be repeated by
-- forgetting one — which is exactly how this happened.

update auth.users
   set confirmation_token      = coalesce(confirmation_token, ''),
       recovery_token          = coalesce(recovery_token, ''),
       email_change            = coalesce(email_change, ''),
       email_change_token_new  = coalesce(email_change_token_new, '')
 where confirmation_token is null
    or recovery_token is null
    or email_change is null
    or email_change_token_new is null;

-- ---------------------------------------------------------------------------
-- The only sanctioned way to create an account by hand.
--
-- Returns the new user's id. Sets a password nobody can know — a bcrypt hash
-- of a uuid generated inside the call and never returned — so the account is
-- reachable only through the reset flow. Creates the email identity, without
-- which GoTrue will not sign the account in at all.
--
-- Every token column GoTrue reads is named explicitly, including the four
-- that have no default. That is the whole point of this existing.
-- ---------------------------------------------------------------------------
create or replace function public.new_auth_user(p_email text, p_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare uid uuid := gen_random_uuid();
begin
  if exists (select 1 from auth.users u where u.email = p_email) then
    select u.id into uid from auth.users u where u.email = p_email;
    return uid;
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    email_change_token_current, phone_change, phone_change_token,
    reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    p_email, crypt(gen_random_uuid()::text, gen_salt('bf')), now(),
    now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    case when p_name is null then '{}'::jsonb else jsonb_build_object('full_name', p_name) end,
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (
    provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    uid::text, uid,
    jsonb_build_object('sub', uid::text, 'email', p_email, 'email_verified', true),
    'email', now(), now(), now()
  );

  return uid;
end $$;

revoke all on function public.new_auth_user(text, text) from public, anon, authenticated;

comment on function public.new_auth_user(text, text) is
  'Create an account by hand without tripping over GoTrue. Names every token '
  'column, including confirmation_token, recovery_token, email_change and '
  'email_change_token_new, which have no default and which GoTrue cannot read '
  'as NULL. Never write the INSERT directly.';
