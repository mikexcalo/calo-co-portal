-- ============================================================================
-- ASKING FOR THE GOOGLE REVIEW
-- ============================================================================
-- For a contractor this is the marketing. Not a campaign, not a funnel: the
-- number of stars next to the business name when somebody searches. A trade
-- with forty reviews gets called and one with four does not, and the only
-- difference between them is usually that one of them asks.
--
-- Asking is a five second job that nobody does, because it happens on the day
-- the work finishes, which is the day you are already onto the next thing.
-- ============================================================================

alter table public.orgs
  add column if not exists review_link text;

comment on column public.orgs.review_link is
  'The Google review URL for this business. Null means asking is switched off, which is the safe default: sending people to a broken link is worse than not asking.';

alter table public.orgs
  add column if not exists review_delay_days int not null default 1
    check (review_delay_days between 0 and 30);

comment on column public.orgs.review_delay_days is
  'Days after a job completes before asking. Default one: the same day is pushy while somebody is still tidying up, and a week later they have forgotten which company you were.';

-- ---------------------------------------------------------------------------
-- One ask per job, and evidence that it worked.
--
-- A row per job rather than per customer, because a repeat customer should be
-- asked again after the next job. The unique index is what stops the daily
-- pass from asking twice.
-- ---------------------------------------------------------------------------

create table if not exists public.review_requests (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  job_id      uuid not null references jobs(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,

  -- Sent to whoever it went to, recorded as text: the customer's email can
  -- change afterwards and the record of where it actually went should not.
  sent_to     text,
  sent_at     timestamptz,

  /**
   * The link they follow, so a click is measurable.
   *
   * Without this the whole feature is unfalsifiable: you would be sending
   * emails forever with no idea whether anybody ever went. Reviews themselves
   * cannot be attributed, because Google will not tell us, and pretending
   * otherwise would be inventing a number.
   */
  token       text unique not null default encode(gen_random_bytes(12), 'hex'),
  clicked_at  timestamptz,

  created_at  timestamptz not null default now()
);

create unique index if not exists review_requests_one_per_job
  on public.review_requests(job_id);

create index if not exists review_requests_org_idx
  on public.review_requests(org_id, sent_at desc);

alter table public.review_requests enable row level security;

drop policy if exists review_requests_own on public.review_requests;
create policy review_requests_own on public.review_requests
  for all to authenticated
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

-- ---------------------------------------------------------------------------
-- Who to ask, worked out in one place.
--
-- Two exclusions are the whole judgement of this feature.
--
-- Nobody with money outstanding. Asking a customer for five stars while you
-- are chasing their invoice is how you get one star and lose the invoice, and
-- it is the mistake automated review tools make constantly.
--
-- Nobody without an email, obviously, and nobody who has already been asked
-- for this job.
-- ---------------------------------------------------------------------------

create or replace view public.review_due as
  select
    j.id          as job_id,
    j.org_id,
    j.customer_id,
    j.name        as job_name,
    c.name        as customer_name,
    c.email       as customer_email,
    j.completed_on,
    o.review_link,
    o.review_delay_days
  from jobs j
  join orgs o on o.id = j.org_id
  left join customers c on c.id = j.customer_id
  where j.status = 'complete'
    and j.completed_on is not null
    and o.review_link is not null
    and c.email is not null
    and j.completed_on <= current_date - o.review_delay_days
    -- Give up after a month. A request about a job somebody has forgotten is
    -- worse than no request.
    and j.completed_on >= current_date - 30
    and not exists (select 1 from review_requests r where r.job_id = j.id)
    and not exists (
      select 1 from job_invoices i
      where i.job_id = j.id
        and i.status <> 'void'
        and i.total > i.amount_paid
    );

comment on view public.review_due is
  'Finished jobs worth asking about. Excludes anyone still owing money: asking for five stars while chasing an invoice is how you get one star and lose the invoice.';
