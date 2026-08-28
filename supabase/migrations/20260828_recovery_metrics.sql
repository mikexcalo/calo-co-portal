-- ============================================================================
-- RECOVERY METRICS — what the system caught
-- ============================================================================
-- The honest framing matters more than the numbers.
--
-- Nautilus cannot claim it created revenue. Mark created the revenue by doing
-- the work. What it CAN measure is leakage it closed: work that was recorded,
-- sat unbilled long enough that it was plausibly going to be forgotten, and
-- then got invoiced.
--
-- The 21-day threshold is a judgement call and it is deliberately
-- conservative. Anything billed inside three weeks is a normal billing cycle
-- and gets no credit — claiming it would inflate the number and a contractor
-- would spot that immediately. One inflated figure poisons the honest ones.
-- ============================================================================

create or replace view recovery_metrics
with (security_invoker = true)
as
with billed_labor as (
  select
    t.org_id,
    i.issued_on                                   as billed_on,
    t.hours * t.rate                              as value,
    i.issued_on - t.worked_on                     as days_to_bill
  from time_entries t
  join job_invoices i on i.id = t.invoiced_on
  where t.billable and i.status <> 'void' and i.issued_on is not null
),
billed_costs as (
  select
    c.org_id,
    i.issued_on                                   as billed_on,
    c.amount                                      as value,
    i.issued_on - c.purchased_on                  as days_to_bill
  from costs c
  join job_invoices i on i.id = c.invoiced_on
  where c.billable and i.status <> 'void' and i.issued_on is not null
),
all_billed as (
  select * from billed_labor
  union all
  select * from billed_costs
)
select
  org_id,
  date_trunc('month', billed_on)::date            as month,

  count(*)                                        as items_billed,
  round(sum(value)::numeric, 2)                   as total_billed,

  -- The claim: recorded, left sitting, then caught and billed.
  round(sum(value) filter (where days_to_bill > 21)::numeric, 2) as recovered,
  count(*) filter (where days_to_bill > 21)       as recovered_items,

  -- How long work waits before it gets billed. Falling is the win.
  round(avg(days_to_bill)::numeric, 1)            as avg_days_to_bill,
  max(days_to_bill)                               as slowest_days
from all_billed
group by org_id, date_trunc('month', billed_on);

comment on view recovery_metrics is
  'What was caught, not what was earned. Only work billed more than 21 days after it happened counts as recovered — anything faster is a normal cycle.';
