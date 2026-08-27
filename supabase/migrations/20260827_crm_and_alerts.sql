-- ============================================================================
-- CRM DEPTH + NOTIFICATIONS
-- ============================================================================
-- The customer list was a name, an email and three numbers. That's a contact
-- list, not a CRM. What was actually missing:
--
--   - a face (people remember faces, not rows)
--   - a history (what was said, and when)
--   - a next step (a CRM's whole job is telling you who to call today)
--   - a stage (a prospect is not a client is not a lapsed client)
--
-- Plus: a way to find out something happened without staring at the app.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------

alter table customers add column if not exists avatar_url text;
alter table customers add column if not exists website text;

alter table customers add column if not exists stage text not null default 'active'
  check (stage in ('prospect','active','past','lost'));

-- The two fields that make a CRM a CRM rather than an address book.
alter table customers add column if not exists next_action text;
alter table customers add column if not exists next_action_on date;

alter table customers add column if not exists last_contacted_on date;

create index if not exists customers_stage_idx on customers(org_id, stage);
create index if not exists customers_next_action_idx
  on customers(org_id, next_action_on) where next_action_on is not null;

comment on column customers.next_action is
  'What you owe this customer next. The list sorts by when it is due.';

-- ---------------------------------------------------------------------------
-- customer_notes — the history
--
-- Every call, email, meeting and note against a customer, newest first. This
-- is the thing you actually read before picking up the phone.
-- ---------------------------------------------------------------------------

create table if not exists customer_notes (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id) on delete cascade,
  customer_id   uuid not null references customers(id) on delete cascade,
  job_id        uuid references jobs(id) on delete set null,

  kind          text not null default 'note'
                  check (kind in ('note','call','email','meeting','quote','system')),
  body          text not null,

  -- 'system' entries are written by the app (lead arrived, invoice paid) so
  -- the history is complete without anyone typing it.
  author_id     uuid references auth.users(id) on delete set null,
  happened_on   date not null default current_date,
  created_at    timestamptz not null default now()
);

create index if not exists customer_notes_customer_idx
  on customer_notes(customer_id, happened_on desc);

alter table customer_notes enable row level security;

drop policy if exists customer_notes_org_wall on customer_notes;
create policy customer_notes_org_wall on customer_notes
  for all to authenticated
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

-- ---------------------------------------------------------------------------
-- notifications — tell me something happened
--
-- A lead arriving or an invoice being paid should not require anyone to be
-- looking at the app. These are written server-side by the endpoints that
-- know, and read by the bell in the top bar.
-- ---------------------------------------------------------------------------

create table if not exists notifications (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id) on delete cascade,

  kind          text not null
                  check (kind in ('lead','invoice_paid','invoice_overdue',
                                  'site_request','document','system')),
  title         text not null,
  body          text,
  href          text,

  -- Null means everyone in the business sees it.
  user_id       uuid references auth.users(id) on delete cascade,
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists notifications_org_idx on notifications(org_id, created_at desc);
create index if not exists notifications_unread_idx
  on notifications(org_id) where read_at is null;

alter table notifications enable row level security;

drop policy if exists notifications_org_wall on notifications;
create policy notifications_org_wall on notifications
  for all to authenticated
  using (
    org_id = current_org_id()
    and (user_id is null or user_id = auth.uid())
  )
  with check (org_id = current_org_id());

-- ---------------------------------------------------------------------------
-- Customer rollup — one read for the CRM list
-- ---------------------------------------------------------------------------

create or replace view customer_summary
with (security_invoker = true)
as
select
  c.id                              as customer_id,
  c.org_id,
  c.name,
  c.contact_name,
  c.contact_title,
  c.email,
  c.phone,
  c.avatar_url,
  c.stage,
  c.next_action,
  c.next_action_on,
  c.last_contacted_on,

  coalesce(j.job_count, 0)          as jobs,
  coalesce(j.open_jobs, 0)          as open_jobs,
  coalesce(l.invoiced, 0)           as invoiced,
  coalesce(l.collected, 0)          as collected,
  coalesce(l.invoiced, 0) - coalesce(l.collected, 0) as owed,
  coalesce(l.unbilled, 0)           as unbilled,
  n.last_note_on
from customers c
left join (
  select customer_id,
         count(*) as job_count,
         count(*) filter (where status in ('lead','estimating','won','active')) as open_jobs
  from jobs where customer_id is not null group by customer_id
) j on j.customer_id = c.id
left join (
  select jb.customer_id,
         sum(lg.invoiced_total) as invoiced,
         sum(lg.collected)      as collected,
         sum(lg.unbilled_labor + lg.unbilled_cost) as unbilled
  from job_ledger lg
  join jobs jb on jb.id = lg.job_id
  where jb.customer_id is not null
  group by jb.customer_id
) l on l.customer_id = c.id
left join (
  select customer_id, max(happened_on) as last_note_on
  from customer_notes group by customer_id
) n on n.customer_id = c.id;
