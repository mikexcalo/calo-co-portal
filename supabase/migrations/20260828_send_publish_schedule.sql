-- ============================================================================
-- SENDING ESTIMATES, PUBLISHING PRICES, CALENDAR FEEDS
-- ============================================================================
-- Three features that all need the same thing: a way for someone WITHOUT a
-- login to reach one specific piece of data and nothing else.
--
-- A homeowner accepting a quote will not create an account. A marketing site
-- fetching a price list has no session. A phone calendar subscribing to a
-- feed cannot log in.
--
-- So each gets an unguessable token scoped to exactly one thing. A token is
-- not a password — it is a capability. Whoever holds it can do the one thing
-- it permits, which is why each is narrow and each can be revoked by
-- regenerating it.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Estimates: send and get a decision
-- ---------------------------------------------------------------------------

alter table estimates add column if not exists public_token text unique;
alter table estimates add column if not exists sent_to text;
alter table estimates add column if not exists viewed_at timestamptz;
alter table estimates add column if not exists decided_by_name text;
alter table estimates add column if not exists decline_reason text;

create index if not exists estimates_token_idx on estimates(public_token)
  where public_token is not null;

comment on column estimates.public_token is
  'Capability token for the customer-facing accept page. Regenerate to revoke.';
comment on column estimates.viewed_at is
  'First time the customer opened it. Useful on its own — "sent but never opened" is a different problem from "opened and ignored".';

-- ---------------------------------------------------------------------------
-- Per-business tokens for the price feed and the calendar feed
-- ---------------------------------------------------------------------------

alter table orgs add column if not exists price_feed_token text unique;
alter table orgs add column if not exists calendar_token text unique;

comment on column orgs.price_feed_token is
  'Lets a marketing site fetch the published price list. Only items flagged public are returned.';
comment on column orgs.calendar_token is
  'Subscribe URL for a phone calendar. Read-only; regenerating it revokes every existing subscription.';

-- Give the existing businesses tokens now so nothing has to be set up by hand.
update orgs
set price_feed_token = coalesce(price_feed_token, encode(gen_random_bytes(18), 'hex')),
    calendar_token   = coalesce(calendar_token,   encode(gen_random_bytes(18), 'hex'));

-- ---------------------------------------------------------------------------
-- Scheduling: jobs need dates before a calendar means anything
-- ---------------------------------------------------------------------------

alter table jobs add column if not exists scheduled_start date;
alter table jobs add column if not exists scheduled_end date;

create index if not exists jobs_scheduled_idx on jobs(org_id, scheduled_start)
  where scheduled_start is not null;

-- ---------------------------------------------------------------------------
-- What is ready to be billed
--
-- A retainer with a cadence and unbilled work sitting on it should be
-- surfaced, not remembered. This answers "what should I invoice today"
-- in one read.
-- ---------------------------------------------------------------------------

create or replace view billing_due
with (security_invoker = true)
as
select
  j.id                as job_id,
  j.org_id,
  j.name,
  j.billing_period,
  j.last_billed_on,
  c.name              as customer_name,
  c.email             as customer_email,

  coalesce(t.unbilled_labor, 0) + coalesce(k.unbilled_cost, 0) as unbilled_total,

  -- When it next falls due, from the cadence and the last time it was billed.
  case j.billing_period
    when 'weekly'   then coalesce(j.last_billed_on, j.started_on, j.created_at::date) + interval '7 days'
    when 'biweekly' then coalesce(j.last_billed_on, j.started_on, j.created_at::date) + interval '14 days'
    when 'monthly'  then coalesce(j.last_billed_on, j.started_on, j.created_at::date) + interval '1 month'
    else null
  end::date           as due_on
from jobs j
left join customers c on c.id = j.customer_id
left join (
  select job_id, sum(hours * rate) as unbilled_labor
  from time_entries where billable and invoiced_on is null group by job_id
) t on t.job_id = j.id
left join (
  select job_id, sum(amount) as unbilled_cost
  from costs where billable and invoiced_on is null group by job_id
) k on k.job_id = j.id
where j.billing_period is not null
  and j.billing_period <> 'none'
  and j.status in ('won', 'active', 'complete');
