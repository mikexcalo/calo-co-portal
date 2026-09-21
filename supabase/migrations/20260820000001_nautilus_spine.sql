-- ============================================================================
-- NAUTILUS SPINE
-- ============================================================================
-- The job-centric data model. Replaces the client-centric agency shape.
--
-- Core idea: a JOB is the unit of work. Everything hangs off it.
--   lead -> estimate -> job (costs + hours accumulate) -> invoice
--
-- For time & materials, the invoice is BUILT FROM ACTUALS: time_entries and
-- costs. A receipt becomes a cost becomes an invoice line, and the line keeps
-- a pointer back to its source. That traceability is the whole point.
--
-- Fixed-price is the same model with the estimate locked; actuals then affect
-- margin rather than the customer's bill.
--
-- NAMING NOTE: `job_invoices` / `job_invoice_lines` are named around the old
-- `invoices` table, which still exists during the transition. At sunset:
--   drop table invoices;
--   alter table job_invoices rename to invoices;
--   alter table job_invoice_lines rename to invoice_lines;
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- orgs — multi-tenancy from day one.
-- CALO&CO is one org. Mammoth Construction is another. No hardcoded company.
-- ---------------------------------------------------------------------------

create table if not exists orgs (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  kind          text not null default 'contractor'
                  check (kind in ('agency', 'contractor')),
  -- Defaults that used to be hardcoded in lib/database.ts
  default_labor_rate    numeric(10,2) not null default 0,
  default_material_markup_pct numeric(5,2) not null default 0,
  tax_rate      numeric(5,2) not null default 0,
  settings      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists orgs_updated_at on orgs;
create trigger orgs_updated_at before update on orgs
  for each row execute function set_updated_at();

-- Tie users to an org. Existing profiles table gets a column.
alter table profiles add column if not exists org_id uuid references orgs(id) on delete set null;

create index if not exists profiles_org_id_idx on profiles(org_id);

-- Every RLS policy below resolves the caller's org through this.
create or replace function current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from profiles where id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- customers — who the org bills. For Mammoth: homeowners.
-- ---------------------------------------------------------------------------

create table if not exists customers (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id) on delete cascade,
  name          text not null,
  email         text,
  phone         text,
  address       text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists customers_updated_at on customers;
create trigger customers_updated_at before update on customers
  for each row execute function set_updated_at();

create index if not exists customers_org_id_idx on customers(org_id);

-- ---------------------------------------------------------------------------
-- jobs — THE SPINE.
--
-- A lead is just a job at status 'lead'. There is no separate leads table:
-- the same record moves through the pipeline, which is what makes the app
-- process-oriented instead of module-oriented.
-- ---------------------------------------------------------------------------

create table if not exists jobs (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id) on delete cascade,
  customer_id   uuid references customers(id) on delete set null,

  name          text not null,
  address       text,
  description   text,

  status        text not null default 'lead'
                  check (status in ('lead','estimating','won','active','complete','closed','lost')),

  billing_type  text not null default 'tm'
                  check (billing_type in ('tm','fixed')),

  -- T&M defaults for this job; fall back to the org defaults when null
  labor_rate            numeric(10,2),
  material_markup_pct   numeric(5,2),

  -- Where the lead came from (site form, referral, etc.)
  source        text,

  started_on    date,
  completed_on  date,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists jobs_updated_at on jobs;
create trigger jobs_updated_at before update on jobs
  for each row execute function set_updated_at();

create index if not exists jobs_org_id_idx on jobs(org_id);
create index if not exists jobs_status_idx on jobs(org_id, status);
create index if not exists jobs_customer_id_idx on jobs(customer_id);

-- ---------------------------------------------------------------------------
-- estimates — for T&M this is a forecast, not a promise.
-- Versioned so a revised estimate doesn't destroy the original.
-- ---------------------------------------------------------------------------

create table if not exists estimates (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id) on delete cascade,
  job_id        uuid not null references jobs(id) on delete cascade,

  version       integer not null default 1,
  status        text not null default 'draft'
                  check (status in ('draft','sent','accepted','declined','superseded')),

  -- Denormalized sum of estimate_lines, kept current by the app
  total         numeric(12,2) not null default 0,

  valid_until   date,
  notes         text,
  sent_at       timestamptz,
  decided_at    timestamptz,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (job_id, version)
);

drop trigger if exists estimates_updated_at on estimates;
create trigger estimates_updated_at before update on estimates
  for each row execute function set_updated_at();

create index if not exists estimates_job_id_idx on estimates(job_id);

create table if not exists estimate_lines (
  id            uuid primary key default gen_random_uuid(),
  estimate_id   uuid not null references estimates(id) on delete cascade,

  kind          text not null default 'labor'
                  check (kind in ('labor','material','subcontractor','other')),
  description   text not null,
  qty           numeric(10,2) not null default 1,
  unit          text,
  unit_price    numeric(12,2) not null default 0,
  total         numeric(12,2) not null default 0,
  position      integer not null default 0,

  created_at    timestamptz not null default now()
);

create index if not exists estimate_lines_estimate_id_idx on estimate_lines(estimate_id);

-- ---------------------------------------------------------------------------
-- time_entries — labor actuals. Half of the T&M billing input.
-- ---------------------------------------------------------------------------

create table if not exists time_entries (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id) on delete cascade,
  job_id        uuid not null references jobs(id) on delete cascade,

  worked_on     date not null default current_date,
  hours         numeric(6,2) not null,
  rate          numeric(10,2) not null,
  worker_name   text,
  description   text,

  billable      boolean not null default true,
  -- Set when this entry has been pulled onto an invoice. Null = unbilled.
  -- FK added after job_invoices exists (see "Deferred foreign keys" below).
  invoiced_on   uuid,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists time_entries_updated_at on time_entries;
create trigger time_entries_updated_at before update on time_entries
  for each row execute function set_updated_at();

create index if not exists time_entries_job_id_idx on time_entries(job_id);
create index if not exists time_entries_unbilled_idx
  on time_entries(job_id) where invoiced_on is null and billable;

-- ---------------------------------------------------------------------------
-- documents — the shoebox.
--
-- Old papers, receipts, scattered files land here. Extraction reads them once
-- and writes structured data into `extracted`. Cost is recorded per document
-- so the running total is always visible — this is a one-time cost per file,
-- never a per-query one.
-- ---------------------------------------------------------------------------

create table if not exists documents (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id) on delete cascade,
  -- Both nullable: a document can arrive before anyone knows where it belongs.
  job_id        uuid references jobs(id) on delete set null,
  customer_id   uuid references customers(id) on delete set null,

  storage_path  text not null,
  file_name     text not null,
  mime_type     text,
  size_bytes    bigint,

  kind          text not null default 'unknown'
                  check (kind in ('receipt','invoice','estimate','permit','contract','photo','other','unknown')),

  status        text not null default 'uploaded'
                  check (status in ('uploaded','processing','extracted','needs_review','filed','failed')),

  -- Raw structured output from extraction
  extracted             jsonb,
  extraction_confidence numeric(4,3),
  extraction_model      text,
  extraction_cost_cents numeric(10,4),
  extracted_at          timestamptz,
  extraction_error      text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists documents_updated_at on documents;
create trigger documents_updated_at before update on documents
  for each row execute function set_updated_at();

create index if not exists documents_org_id_idx on documents(org_id);
create index if not exists documents_job_id_idx on documents(job_id);
create index if not exists documents_status_idx on documents(org_id, status);
-- The inbox query: everything not yet filed against a job
create index if not exists documents_unfiled_idx
  on documents(org_id) where job_id is null;

-- ---------------------------------------------------------------------------
-- costs — material/expense actuals. The other half of T&M billing input.
--
-- This is what a receipt BECOMES. document_id points back to the paper.
-- ---------------------------------------------------------------------------

create table if not exists costs (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id) on delete cascade,
  job_id        uuid not null references jobs(id) on delete cascade,
  -- The receipt this came from, when it came from one
  document_id   uuid references documents(id) on delete set null,

  kind          text not null default 'material'
                  check (kind in ('material','subcontractor','equipment','permit','other')),
  vendor        text,
  description   text,
  purchased_on  date not null default current_date,
  amount        numeric(12,2) not null,

  billable      boolean not null default true,
  markup_pct    numeric(5,2),
  -- FK added after job_invoices exists (see "Deferred foreign keys" below).
  invoiced_on   uuid,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists costs_updated_at on costs;
create trigger costs_updated_at before update on costs
  for each row execute function set_updated_at();

create index if not exists costs_job_id_idx on costs(job_id);
create index if not exists costs_document_id_idx on costs(document_id);
create index if not exists costs_unbilled_idx
  on costs(job_id) where invoiced_on is null and billable;

-- ---------------------------------------------------------------------------
-- job_invoices — built from actuals, not typed by hand.
-- ---------------------------------------------------------------------------

create table if not exists job_invoices (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id) on delete cascade,
  job_id        uuid not null references jobs(id) on delete cascade,

  number        text not null,
  status        text not null default 'draft'
                  check (status in ('draft','sent','partial','paid','overdue','void')),

  -- T&M invoices cover a window of work
  period_start  date,
  period_end    date,

  issued_on     date,
  due_on        date,

  subtotal      numeric(12,2) not null default 0,
  tax_rate      numeric(5,2) not null default 0,
  tax_amount    numeric(12,2) not null default 0,
  total         numeric(12,2) not null default 0,
  amount_paid   numeric(12,2) not null default 0,

  notes         text,
  sent_at       timestamptz,
  paid_at       timestamptz,

  -- Reserved for Stripe Invoicing, so payment status can stop being manual
  external_ref  text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (org_id, number)
);

drop trigger if exists job_invoices_updated_at on job_invoices;
create trigger job_invoices_updated_at before update on job_invoices
  for each row execute function set_updated_at();

create index if not exists job_invoices_job_id_idx on job_invoices(job_id);
create index if not exists job_invoices_status_idx on job_invoices(org_id, status);

create table if not exists job_invoice_lines (
  id            uuid primary key default gen_random_uuid(),
  invoice_id    uuid not null references job_invoices(id) on delete cascade,

  kind          text not null default 'labor'
                  check (kind in ('labor','material','subcontractor','other')),
  description   text not null,
  qty           numeric(10,2) not null default 1,
  unit          text,
  unit_price    numeric(12,2) not null default 0,
  total         numeric(12,2) not null default 0,
  position      integer not null default 0,

  -- THE TRACEABILITY. Every billed line points back at the hours logged or
  -- the receipt photographed that produced it.
  source_time_entry_id uuid references time_entries(id) on delete set null,
  source_cost_id       uuid references costs(id) on delete set null,

  created_at    timestamptz not null default now()
);

create index if not exists job_invoice_lines_invoice_id_idx on job_invoice_lines(invoice_id);

-- ---------------------------------------------------------------------------
-- Deferred foreign keys
-- time_entries and costs are created before job_invoices (invoices are built
-- FROM them), so their invoiced_on FKs are attached here.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'time_entries_invoiced_on_fkey'
  ) then
    alter table time_entries
      add constraint time_entries_invoiced_on_fkey
      foreign key (invoiced_on) references job_invoices(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'costs_invoiced_on_fkey'
  ) then
    alter table costs
      add constraint costs_invoiced_on_fkey
      foreign key (invoiced_on) references job_invoices(id) on delete set null;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Row level security — every table walled by org.
-- ---------------------------------------------------------------------------

alter table orgs               enable row level security;
alter table customers          enable row level security;
alter table jobs               enable row level security;
alter table estimates          enable row level security;
alter table estimate_lines     enable row level security;
alter table time_entries       enable row level security;
alter table documents          enable row level security;
alter table costs              enable row level security;
alter table job_invoices       enable row level security;
alter table job_invoice_lines  enable row level security;

-- Your own org
drop policy if exists orgs_own on orgs;
create policy orgs_own on orgs
  for all to authenticated
  using (id = current_org_id())
  with check (id = current_org_id());

-- Tables carrying org_id directly. Written out one by one on purpose: a loop
-- generating these with dynamic SQL saves twenty lines and costs you every
-- future debugging session.

drop policy if exists customers_org_wall on customers;
create policy customers_org_wall on customers
  for all to authenticated
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

drop policy if exists jobs_org_wall on jobs;
create policy jobs_org_wall on jobs
  for all to authenticated
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

drop policy if exists estimates_org_wall on estimates;
create policy estimates_org_wall on estimates
  for all to authenticated
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

drop policy if exists time_entries_org_wall on time_entries;
create policy time_entries_org_wall on time_entries
  for all to authenticated
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

drop policy if exists documents_org_wall on documents;
create policy documents_org_wall on documents
  for all to authenticated
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

drop policy if exists costs_org_wall on costs;
create policy costs_org_wall on costs
  for all to authenticated
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

drop policy if exists job_invoices_org_wall on job_invoices;
create policy job_invoices_org_wall on job_invoices
  for all to authenticated
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

-- Child tables inherit the wall through their parent
drop policy if exists estimate_lines_org_wall on estimate_lines;
create policy estimate_lines_org_wall on estimate_lines
  for all to authenticated
  using (exists (
    select 1 from estimates e
    where e.id = estimate_lines.estimate_id and e.org_id = current_org_id()
  ))
  with check (exists (
    select 1 from estimates e
    where e.id = estimate_lines.estimate_id and e.org_id = current_org_id()
  ));

drop policy if exists job_invoice_lines_org_wall on job_invoice_lines;
create policy job_invoice_lines_org_wall on job_invoice_lines
  for all to authenticated
  using (exists (
    select 1 from job_invoices i
    where i.id = job_invoice_lines.invoice_id and i.org_id = current_org_id()
  ))
  with check (exists (
    select 1 from job_invoices i
    where i.id = job_invoice_lines.invoice_id and i.org_id = current_org_id()
  ));

-- ---------------------------------------------------------------------------
-- job_ledger — one query for "how is this job doing".
--
-- Replaces the N+1 loop the old financials page ran (one round trip per
-- client). Billed vs unbilled, costs vs revenue, margin — computed in the
-- database, read in a single request.
-- ---------------------------------------------------------------------------

create or replace view job_ledger
with (security_invoker = true)
as
select
  j.id                as job_id,
  j.org_id,
  j.name,
  j.status,
  j.billing_type,
  j.customer_id,

  coalesce(l.hours, 0)              as hours_logged,
  coalesce(l.labor_value, 0)        as labor_value,
  coalesce(l.unbilled_labor, 0)     as unbilled_labor,

  coalesce(c.cost_total, 0)         as cost_total,
  coalesce(c.unbilled_cost, 0)      as unbilled_cost,

  coalesce(i.invoiced_total, 0)     as invoiced_total,
  coalesce(i.collected, 0)          as collected,

  coalesce(e.estimate_total, 0)     as estimate_total,

  -- Margin so far: what we've billed minus what the job actually cost us
  coalesce(i.invoiced_total, 0) - coalesce(c.cost_total, 0) as margin_to_date
from jobs j
left join (
  select job_id,
         sum(hours)                                          as hours,
         sum(hours * rate)                                   as labor_value,
         sum(case when invoiced_on is null and billable
                  then hours * rate else 0 end)              as unbilled_labor
  from time_entries group by job_id
) l on l.job_id = j.id
left join (
  select job_id,
         sum(amount)                                         as cost_total,
         sum(case when invoiced_on is null and billable
                  then amount else 0 end)                    as unbilled_cost
  from costs group by job_id
) c on c.job_id = j.id
left join (
  select job_id,
         sum(total)       as invoiced_total,
         sum(amount_paid) as collected
  from job_invoices where status <> 'void' group by job_id
) i on i.job_id = j.id
left join (
  select job_id, total as estimate_total
  from estimates where status = 'accepted'
) e on e.job_id = j.id;
