-- ============================================================================
-- A VIEW ANYBODY COULD READ
-- ============================================================================
-- access_by_day summarises access_events — who signed in, when, how many
-- screens. access_events is behind row-level security like everything else.
-- The view was not.
--
-- A view runs as its OWNER unless told otherwise, so it read the underlying
-- table with the owner's rights and handed the result to whoever asked. And
-- anon held SELECT on it. So anybody with the project URL and the publishable
-- key — which is in the page source of every site that talks to Supabase, by
-- design — could read every user's email address and when they last signed in.
--
-- Verified rather than assumed: a signed-out request returned Mike's address,
-- Mark's address and their sign-in times, while the same request against
-- customers correctly returned nothing.
--
-- Two changes, because either alone leaves a gap:
--   security_invoker makes the view read with the CALLER's rights, so the
--   row-level policies on access_events apply to it like any other query.
--   Revoking anon means a signed-out request cannot reach it at all, whatever
--   the view is later redefined to do.
-- ============================================================================

alter view public.access_by_day set (security_invoker = on);

revoke all on public.access_by_day from anon;

comment on view public.access_by_day is
  'Sign-in activity by day. security_invoker so row-level security applies; not readable signed out.';

-- ---------------------------------------------------------------------------
-- Anything else of the same shape.
--
-- One view was found by an emailed advisory. The rest are checked here rather
-- than waiting for the next email: no view in public should be readable by a
-- signed-out request unless it exists to be public.
-- ---------------------------------------------------------------------------

do $$
declare v record;
begin
  for v in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind in ('v', 'm')
       and has_table_privilege('anon', c.oid, 'SELECT')
  loop
    raise notice 'View readable by anon: %', v.relname;
  end loop;
end $$;
