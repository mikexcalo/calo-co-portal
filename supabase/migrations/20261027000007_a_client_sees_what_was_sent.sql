-- ============================================================================
-- A draft is not a debt. Third time, and this one faces the client.
--
-- client_account is the view behind "Bills to You" — the screen a client opens
-- to see what they owe the agency. It summed every invoice that was not void,
-- so a draft counted as invoiced and therefore as owed.
--
-- John's arrangement is retroactive and the pricing is not settled. Had that
-- screen been switched on for him, he would have opened it and found $110
-- outstanding against an invoice nobody has sent him, at a figure still being
-- agreed. That is worse than a wrong number on an internal dashboard: it is a
-- claim, presented to the person it is a claim against.
--
-- Same fix as job_ledger. Money moves unbilled -> drafted -> invoiced ->
-- collected, and a client can only see the last two. drafted is carried so the
-- agency side can still see it, and so the hours behind it do not vanish out
-- of both columns the moment a draft claims them.
-- ============================================================================

create or replace view client_account
with (security_invoker = true)
as
select
  j.id                                as job_id,
  j.name                              as engagement,
  j.billing_period,
  j.last_billed_on,
  c.linked_org_id                     as client_org_id,
  o.name                              as agency_name,

  coalesce(t.hours, 0)                as hours_logged,
  coalesce(t.unbilled_value, 0)       as accruing,

  coalesce(i.invoiced, 0)             as invoiced_total,
  coalesce(i.paid, 0)                 as paid_total,
  coalesce(i.invoiced, 0) - coalesce(i.paid, 0) as owed,
  -- Appended, because create or replace view can only add columns at the end.
  coalesce(i.drafted, 0)              as drafted_total
from jobs j
join customers c on c.id = j.customer_id
join orgs o on o.id = j.org_id
left join (
  select job_id,
         sum(hours) as hours,
         sum(case when invoiced_on is null then hours * rate else 0 end) as unbilled_value
  from time_entries where billable group by job_id
) t on t.job_id = j.id
left join (
  select job_id,
         -- Issued means it left the building.
         sum(total)       filter (where status <> 'draft') as invoiced,
         sum(amount_paid) filter (where status <> 'draft') as paid,
         -- Written, not sent. Never shown to the client.
         sum(total)       filter (where status =  'draft') as drafted
  from job_invoices where status <> 'void' group by job_id
) i on i.job_id = j.id
where c.linked_org_id is not null;

-- ----------------------------------------------------------------------------
-- And switch the screen on for the two clients it is true for.
--
-- "Bills to You" is off for every business kind on purpose: it means what you
-- owe the agency that set your workspace up, which is true of John and Mark
-- and false of somebody who found this product on their own. A permanently
-- empty nav row teaches people the app is full of things that do nothing.
-- ----------------------------------------------------------------------------
--
-- Matched on slug OR name, and it says what it did. The last migration that
-- keyed on a display name matched nothing and reported success, which is how
-- John spent a day filed as a contractor after it was supposedly fixed.
do $$
declare
  r record;
  n int := 0;
begin
  for r in
    select id, name, slug from public.orgs
     where slug in ('global-seafood', 'mammoth')
        or name in ('Global Seafood Partners', 'Mammoth Construction')
  loop
    update public.orgs
       set modules = coalesce(modules, '{}'::jsonb) || '{"account": true}'::jsonb
     where id = r.id;
    raise notice 'Bills to You switched on for % (%)', r.name, r.slug;
    n := n + 1;
  end loop;

  if n = 0 then
    raise exception 'Matched no orgs. Check the slugs: select id, name, slug from orgs;';
  end if;
  raise notice '% workspace(s) updated.', n;
end $$;
