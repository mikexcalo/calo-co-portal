-- ============================================================================
-- THE VIEWS WENT AROUND THE ONLY WALL THIS HAS
-- ============================================================================
-- Found because four demo clients appeared in CALO&CO's client list with money
-- against them. The demo data was filed correctly; the reading was wrong.
--
-- Every table has row level security and every policy is org_id =
-- current_org_id(). That was never the problem. A Postgres view runs with the
-- privileges of its OWNER unless security_invoker is set, and these were owned
-- by postgres, so reading through a view executed as postgres and row level
-- security on the base tables simply did not apply. A view cannot carry
-- policies of its own, so there was nothing underneath to catch it.
--
-- The consequence was not cosmetic. client_overview returns every client in
-- every workspace with invoiced, owed and unbilled totals. Mark logging in to
-- Mammoth could read CALO&CO's client list and what each of them owes, and
-- any future client could read every other client's. The choke point was
-- exactly one join away from doing nothing.
--
-- Six views already had security_invoker set. That is the worst version of
-- this: somebody knew, fixed the ones in front of them, and left the rest,
-- which reads as deliberate and is impossible to spot by sampling.
--
-- No public path reads any of these. The capability-token pages go through
-- SECURITY DEFINER functions that check a token, which is the correct way to
-- expose one row to somebody with no account.
-- ============================================================================

alter view public.client_overview     set (security_invoker = true);
alter view public.customer_summary    set (security_invoker = true);
alter view public.follow_ups          set (security_invoker = true);
alter view public.job_ledger          set (security_invoker = true);
alter view public.review_due          set (security_invoker = true);
alter view public.unresolved          set (security_invoker = true);
alter view public.week_ahead          set (security_invoker = true);

-- Shipped in the same session as this fix and born with the same defect.
alter view public.site_traffic_daily  set (security_invoker = true);
alter view public.site_sources_30d    set (security_invoker = true);
alter view public.site_pages_30d      set (security_invoker = true);

/**
 * A standing check, so this cannot come back quietly.
 *
 * The failure mode here is a new view added months from now by somebody who
 * does not know this rule, and a leak nobody notices because the screen looks
 * right when there is only one workspace in the database. Naming the rule in
 * SQL means it can be asserted rather than remembered.
 */
create or replace function public.views_without_rls()
returns table (view_name text)
language sql
stable
security definer
set search_path = public
as $function$
  select c.relname::text
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'v'
     and not coalesce(
       (select option_value = 'true'
          from pg_options_to_table(c.reloptions)
         where option_name = 'security_invoker'),
       false
     )
   order by c.relname;
$function$;

comment on function public.views_without_rls is
  'Any view here reads past row level security, because a view runs as its owner unless security_invoker is set. Should always return zero rows.';
