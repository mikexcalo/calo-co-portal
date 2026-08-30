-- ============================================================================
-- OVERHEADS — the costs that are not any one job's fault
-- ============================================================================
-- Until now every cost had to belong to a job, because every cost we imagined
-- was a receipt for materials. But software subscriptions, insurance, fuel,
-- the phone bill and the accountant are all real money leaving the business
-- and none of them belong to a job.
--
-- Leaving them out does not make the numbers neutral, it makes them wrong in
-- a specific and flattering direction: Profit & Loss shows what the jobs
-- earned and none of what it costs to be open. That is the number that makes
-- a business think it is doing better than it is.
--
-- So job_id becomes optional. A cost with a job is a job cost; a cost without
-- one is overhead.
-- ============================================================================

alter table costs alter column job_id drop not null;

-- An overhead cannot be billed to a customer, because there is no customer to
-- bill it to. Enforced rather than trusted: the billing code claims unbilled
-- costs by job, and a billable overhead with no job would sit in the queue
-- forever, invisible and unclaimable.
alter table costs drop constraint if exists costs_overhead_not_billable;
alter table costs add constraint costs_overhead_not_billable
  check (job_id is not null or billable = false);

-- ---------------------------------------------------------------------------
-- Recurring costs.
--
-- The reason to record this rather than let someone re-enter it monthly: a
-- subscription is the thing people forget they are paying. Knowing something
-- is $25 every month means we can show what a year of it costs, and notice
-- when one has not been recorded lately.
-- ---------------------------------------------------------------------------

alter table costs add column if not exists recurrence text
  check (recurrence in ('once', 'monthly', 'quarterly', 'yearly'));

update costs set recurrence = 'once' where recurrence is null;
alter table costs alter column recurrence set default 'once';

comment on column costs.recurrence is
  'How often this cost repeats. Recording it lets the annual figure be shown, which is the number that changes minds about a subscription.';

comment on column costs.job_id is
  'The job this cost belongs to, or null for business overhead — software, insurance, fuel, anything not caused by one job.';

-- ---------------------------------------------------------------------------
-- What overhead costs, per month and per year.
--
-- security_invoker so this view obeys the same row level security as the
-- table underneath rather than quietly bypassing it.
-- ---------------------------------------------------------------------------

create or replace view overhead_summary
with (security_invoker = true)
as
select
  org_id,
  count(*)                                                          as items,
  round(sum(amount)::numeric, 2)                                    as total_recorded,

  -- What the recurring ones cost every month, normalised to a monthly figure.
  round(sum(
    case recurrence
      when 'monthly'   then amount
      when 'quarterly' then amount / 3
      when 'yearly'    then amount / 12
      else 0
    end
  )::numeric, 2)                                                    as monthly_run_rate,

  count(*) filter (where recurrence <> 'once')                      as subscriptions
from costs
where job_id is null
group by org_id;

comment on view overhead_summary is
  'Business overhead — costs with no job. monthly_run_rate is what the recurring ones cost every month, whatever their billing period.';
