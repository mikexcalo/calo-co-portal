-- ============================================================================
-- POLICIES THAT WERE ON BUT NOT DOING ANYTHING
-- ============================================================================
-- The earlier audit asked the wrong question. It checked whether row level
-- security was switched on, and reported everything protected. Being switched
-- on means nothing if the policy says `USING (true)`.
--
-- Found by testing what a real signed-in account could actually pull, and
-- what a browser with no account at all could pull. Both saw too much.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- assets — the worst of them.
--
-- `portal_all_access` was `FOR ALL USING (true)` granted to the anon role.
-- Anon is not "any logged-in user", it is *anybody*. Forty rows of brand
-- assets were readable with no account, and because the policy covered ALL
-- rather than SELECT, anyone could also have emptied the table.
--
-- Verified before the fix: forty rows returned over plain HTTP with no login.
--
-- Legacy, superseded by the brand kit held in orgs.settings. Locked rather
-- than dropped, for the same reason as the other legacy tables — deleting
-- during a fix is how you find out something still read from it.
-- ---------------------------------------------------------------------------

drop policy if exists portal_all_access on public.assets;
revoke all on public.assets from anon, authenticated;

comment on table public.assets is
  'LEGACY, locked. Superseded by the brand kit in orgs.settings. Had a USING(true) policy open to anon.';

-- ---------------------------------------------------------------------------
-- leads — readable by every signed-in user, of any business.
--
-- `auth.role() = 'authenticated'` is not a tenancy check. It says "is anyone
-- at all logged in", so Mark could have read CALO&CO's inbound leads and vice
-- versa. It survived because it looks like a check.
--
-- This is the old table with no org column; the current lead flow does not
-- use it. One row, and nothing in the codebase reads from here.
-- ---------------------------------------------------------------------------

drop policy if exists "Authenticated users can read leads"   on public.leads;
drop policy if exists "Authenticated users can update leads" on public.leads;
drop policy if exists "Anyone can insert leads"              on public.leads;
revoke all on public.leads from anon, authenticated;

comment on table public.leads is
  'LEGACY, locked. Had a policy that let any signed-in user read every business''s leads.';

-- ---------------------------------------------------------------------------
-- The second-factor gate, extended to the tables that skip current_org_id().
--
-- orgs and memberships answer "which businesses am I in", so they cannot be
-- built on current_org_id() — that would be circular. They therefore missed
-- the gate added with two-factor, and a session that had given a password but
-- no code could still read business names and, worse, UPDATE org settings.
--
-- profiles deliberately stays outside the gate. The middleware reads it to
-- decide whether a code is owed in the first place; gating it would mean the
-- app could never find out that it should be asking.
-- ---------------------------------------------------------------------------

create or replace function public.mfa_ok()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors f
        where f.user_id = auth.uid() and f.status = 'verified'
      )
$function$;

grant execute on function public.mfa_ok() to authenticated;

comment on function public.mfa_ok is
  'True unless this session owes a second factor. The same test current_org_id() makes, for policies that cannot depend on it.';

drop policy if exists orgs_own on public.orgs;
create policy orgs_own on public.orgs
  for select to authenticated
  using (
    mfa_ok()
    and exists (
      select 1 from memberships m
      where m.user_id = auth.uid() and m.org_id = orgs.id
    )
  );

drop policy if exists orgs_admin_update on public.orgs;
create policy orgs_admin_update on public.orgs
  for update to authenticated
  using (
    mfa_ok()
    and exists (
      select 1 from memberships m
      where m.user_id = auth.uid()
        and m.org_id = orgs.id
        and m.role = any (array['owner', 'admin'])
    )
  );

drop policy if exists memberships_own on public.memberships;
create policy memberships_own on public.memberships
  for select to authenticated
  using (mfa_ok() and user_id = auth.uid());
