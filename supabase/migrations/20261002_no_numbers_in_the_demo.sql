-- ============================================================================
-- NO NUMBERS IN THE DEMO, AND NOTHING PRE-SET
-- ============================================================================
-- Invented dollar figures were the wrong call. They read as real on the
-- dashboard, they are the one thing on screen nobody can sanity-check, and
-- they are not what the demo is for.
--
-- Modules are left unset rather than switched on, because Demo is the surface
-- you toggle in front of somebody. Anything pre-configured is a decision
-- already made, which is the opposite of a demonstration.
-- ============================================================================

do $strip$
declare d uuid;
begin
  select id into d from public.orgs where slug = 'demo';
  if d is null then return; end if;

  delete from public.job_invoice_lines
   where invoice_id in (select id from public.job_invoices where org_id = d);
  delete from public.job_invoices where org_id = d;
  delete from public.costs where org_id = d;

  -- Money on the engagements themselves, not just the invoices.
  update public.jobs
     set retainer_amount = null,
         retainer_hours  = null,
         labor_rate      = null,
         billing_type    = 'fixed',
         billing_period  = 'none'
   where org_id = d;

  update public.orgs
     set modules = '{}'::jsonb,
         default_labor_rate = 0
   where id = d;

  update public.customers set modules = '{}'::jsonb where org_id = d;
end
$strip$;
