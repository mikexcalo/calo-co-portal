-- ============================================================================
-- CLIENT BILLING — the agency bills a client who is also a Nautilus business
-- ============================================================================
-- Mike logs hours against a CALO&CO engagement. Mammoth needs to see what's
-- being logged as it happens, what it adds up to, and pay it — from inside
-- their own portal.
--
-- The link is on the CUSTOMER record: a customer can point at a Nautilus org.
-- When it does, that org gets READ access to the engagement's time entries and
-- invoices. Read only, and only for engagements billed to them.
--
-- Showing the client the individual time entries is the point, not a nicety.
-- "$4,200 this month" invites an argument; "Tue 12 Mar, 3.5h, rebuilt the
-- quote form" ends one.
-- ============================================================================

alter table customers
  add column if not exists linked_org_id uuid references orgs(id) on delete set null;

create index if not exists customers_linked_org_idx on customers(linked_org_id);

comment on column customers.linked_org_id is
  'When this customer is itself a Nautilus business, work billed to them is visible in their own portal.';

-- How often this engagement gets invoiced. Drives the "ready to bill" prompt.
alter table jobs
  add column if not exists billing_period text
    check (billing_period in ('none','weekly','biweekly','monthly'));

alter table jobs
  add column if not exists last_billed_on date;

comment on column jobs.billing_period is
  'Retainer cadence. null/none means bill it manually.';

-- ---------------------------------------------------------------------------
-- Is this job billed to the caller's business?
-- Security definer because it must see across the org wall to answer. It
-- returns a boolean, never rows.
-- ---------------------------------------------------------------------------

create or replace function job_is_billed_to_current_org(job uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from jobs j
    join customers c on c.id = j.customer_id
    where j.id = job
      and c.linked_org_id is not null
      and c.linked_org_id = current_org_id()
  )
$$;

-- ---------------------------------------------------------------------------
-- Read-through for the client being billed
-- ---------------------------------------------------------------------------

-- Jobs: the client can see the engagement billed to them.
drop policy if exists jobs_billed_to_me on jobs;
create policy jobs_billed_to_me on jobs
  for select to authenticated
  using (job_is_billed_to_current_org(id));

-- Time entries: this is the transparency. Only billable ones — internal time
-- the agency chose not to charge for is nobody else's business.
drop policy if exists time_entries_billed_to_me on time_entries;
create policy time_entries_billed_to_me on time_entries
  for select to authenticated
  using (billable and job_is_billed_to_current_org(job_id));

-- Invoices raised against them, and their lines.
drop policy if exists job_invoices_billed_to_me on job_invoices;
create policy job_invoices_billed_to_me on job_invoices
  for select to authenticated
  using (job_is_billed_to_current_org(job_id));

drop policy if exists job_invoice_lines_billed_to_me on job_invoice_lines;
create policy job_invoice_lines_billed_to_me on job_invoice_lines
  for select to authenticated
  using (exists (
    select 1 from job_invoices i
    where i.id = job_invoice_lines.invoice_id
      and job_is_billed_to_current_org(i.job_id)
  ));

-- Costs are deliberately NOT exposed. What the agency paid for a contractor or
-- a stock photo is its margin, not the client's business. The client sees what
-- they are charged, which is the invoice.

-- ---------------------------------------------------------------------------
-- What a client owes, in one read
-- ---------------------------------------------------------------------------

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
  coalesce(i.invoiced, 0) - coalesce(i.paid, 0) as owed
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
  select job_id, sum(total) as invoiced, sum(amount_paid) as paid
  from job_invoices where status <> 'void' group by job_id
) i on i.job_id = j.id
where c.linked_org_id is not null;
