-- ============================================================================
-- TWO-FACTOR AUTHENTICATION
-- ============================================================================
-- Until now a password was the only thing between someone and a business's
-- entire book of work — every customer, every invoice, every rate. Passwords
-- get reused, phished and dumped. A second factor is the cheapest real
-- protection available, and unlike SOC 2 it costs nothing but an afternoon.
--
-- Supabase handles the TOTP mechanics: enrolment, the QR code, checking the
-- six digits, and raising the session's assurance level to aal2. What it does
-- not do is enforce anything. A session that skipped the second step is still
-- a valid session, and it can talk to the database directly.
--
-- So the enforcement lives here, in the one function nearly every policy in
-- the schema already depends on.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- The gate.
--
-- current_org_id() answers "which business is this person looking at". Return
-- null and every policy built on it stops matching rows — the whole schema
-- goes quiet at once. That is the point: enforcing in middleware only guards
-- the pages. Anyone holding a half-finished session could skip the app
-- entirely and query the API directly, which is exactly what a stolen token
-- is for.
--
-- Someone with no second factor set up is unaffected — the NOT EXISTS is true
-- for them, so nothing changes. The gate closes only for people who turned it
-- on and then presented a session that never finished the second step.
-- ---------------------------------------------------------------------------

create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $function$
  select p.active_org_id
  from profiles p
  where p.id = auth.uid()
    and exists (
      select 1 from memberships m
      where m.user_id = p.id and m.org_id = p.active_org_id
    )
    and (
      -- Finished both steps.
      coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      -- Or never had a second step to finish.
      or not exists (
        select 1 from auth.mfa_factors f
        where f.user_id = p.id and f.status = 'verified'
      )
    )
$function$;

comment on function public.current_org_id is
  'Which business the caller is viewing, or null. Returns null for a session that owes a second factor — which silently empties every policy built on it.';

-- ---------------------------------------------------------------------------
-- What the app needs to ask.
--
-- The browser cannot read auth.mfa_factors, so these two answer the only
-- questions it has: does this session still owe a code, and does this person
-- have two-factor turned on at all.
-- ---------------------------------------------------------------------------

create or replace function public.mfa_pending()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2'
     and exists (
       select 1 from auth.mfa_factors f
       where f.user_id = auth.uid() and f.status = 'verified'
     )
$function$;

create or replace function public.mfa_enabled()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from auth.mfa_factors f
    where f.user_id = auth.uid() and f.status = 'verified'
  )
$function$;

grant execute on function public.mfa_pending()  to authenticated;
grant execute on function public.mfa_enabled()  to authenticated;

-- ---------------------------------------------------------------------------
-- Recovery codes.
--
-- The thing that stops people turning two-factor on is the fear of losing
-- the phone. That fear is well founded — Supabase has no built-in way back
-- in, and without one the answer is "email Mike and hope he is awake".
--
-- A recovery code does NOT log you in. It removes the second factor, which
-- leaves the password still standing between the attacker and the account.
-- So getting in with a stolen code alone is not possible; you need the code
-- AND the password, which is the same bar as before the code existed.
--
-- Hashes only, and no read policy at all — not even for the person they
-- belong to. A ten-character code is guessable by someone holding its hash
-- and a GPU, so the hash never leaves the database. The app is told how many
-- codes remain and nothing else.
-- ---------------------------------------------------------------------------

create table if not exists public.mfa_recovery_codes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  code_hash   text not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists mfa_recovery_codes_user_idx
  on public.mfa_recovery_codes(user_id) where used_at is null;

alter table public.mfa_recovery_codes enable row level security;

-- Deliberately no policies. Only the service role touches this table, and it
-- does so from routes that have already checked who is asking.
revoke all on public.mfa_recovery_codes from anon, authenticated;

create or replace function public.mfa_recovery_remaining()
returns integer
language sql
stable
security definer
set search_path to 'public'
as $function$
  select count(*)::int
  from mfa_recovery_codes
  where user_id = auth.uid() and used_at is null
$function$;

grant execute on function public.mfa_recovery_remaining() to authenticated;

comment on table public.mfa_recovery_codes is
  'Hashed one-time codes that remove a lost second factor. Never readable by anyone but the service role — a hash plus a GPU is enough to recover a short code.';
