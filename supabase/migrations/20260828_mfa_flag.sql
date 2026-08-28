-- ============================================================================
-- A CHEAP WAY TO ASK "DOES THIS PERSON USE TWO-FACTOR?"
-- ============================================================================
-- The middleware runs on every single request. It already fetches the caller's
-- profile row, so answering the question from that row costs nothing; asking
-- the database separately would add a round trip to every page load in the
-- app. That is not a theoretical worry here — the last outage on this project
-- was middleware waiting on Supabase until Vercel gave up at 25 seconds.
--
-- The flag is a cache, not the truth. The truth is auth.mfa_factors, and the
-- gate that actually stops anything is current_org_id(). A stale flag can send
-- someone to the wrong screen; it cannot show them another business's data.
--
-- Kept honest by a trigger rather than by the app remembering to write it,
-- because the app will eventually forget.
-- ============================================================================

alter table public.profiles
  add column if not exists mfa_enabled boolean not null default false;

comment on column public.profiles.mfa_enabled is
  'Cache of "has a verified second factor", maintained by trigger. Lets middleware answer without a second round trip. Never the security boundary — see current_org_id().';

create or replace function public.sync_mfa_enabled()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  target uuid := coalesce(new.user_id, old.user_id);
begin
  update profiles p
     set mfa_enabled = exists (
       select 1 from auth.mfa_factors f
       where f.user_id = target and f.status = 'verified'
     )
   where p.id = target;
  return coalesce(new, old);
end;
$function$;

drop trigger if exists mfa_factors_sync on auth.mfa_factors;
create trigger mfa_factors_sync
  after insert or update or delete on auth.mfa_factors
  for each row execute function public.sync_mfa_enabled();

-- Backfill, so anyone who enrolled between the two migrations is correct.
update profiles p
   set mfa_enabled = exists (
     select 1 from auth.mfa_factors f
     where f.user_id = p.id and f.status = 'verified'
   );
