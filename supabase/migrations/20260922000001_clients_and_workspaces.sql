-- ============================================================================
-- A CLIENT AND A WORKSPACE ARE DIFFERENT THINGS
-- ============================================================================
-- This is the confusion underneath almost every complaint about the product,
-- and nothing on screen has ever named it.
--
--   A CLIENT is a row in customers. Somebody you do work for. They have an
--   engagement, a brand, a target list, notes. They do not log in.
--
--   A WORKSPACE is a row in orgs. A business that runs itself in here. It has
--   its own jobs, its own invoices, its own customers, its own login.
--
-- Mammoth is both: a client of the agency, and a workspace Mark signs into.
-- John is only the first, which is the honest answer to "why isn't John set
-- up": nobody has decided he should run his own operations yet, and there has
-- never been a button that would do it.
--
-- The two are linked here so the product can finally say which is which, and
-- so the question "does this client have a login" has an answer that is not a
-- guess.
-- ============================================================================

alter table public.customers
  add column if not exists workspace_id uuid references orgs(id) on delete set null;

comment on column public.customers.workspace_id is
  'The workspace this client runs themselves in, when they have one. Null means they are a client you do work for and nothing more, which is the normal case.';

create unique index if not exists customers_one_workspace_each
  on public.customers(workspace_id) where workspace_id is not null;

-- Mammoth is the case that already exists, so the link is made rather than
-- waiting for somebody to press a button that did not exist when they signed up.
update public.customers c
   set workspace_id = o.id
  from public.orgs o
 where c.workspace_id is null
   and lower(o.name) = lower(c.name);

-- ---------------------------------------------------------------------------
-- What a client can reach, whether or not they have a workspace.
--
-- Held on the client rather than only on the workspace, because the decision
-- "Mammoth gets the Search module" is made about Mammoth the client, often
-- before Mammoth the workspace exists. When the workspace is created it reads
-- these, so setting something up for somebody before they pay is a note you
-- write once rather than a thing you redo at handover.
-- ---------------------------------------------------------------------------

alter table public.customers
  add column if not exists modules jsonb not null default '{}'::jsonb;

comment on column public.customers.modules is
  'Modules chosen for this client, whether or not they can log in yet. Copied onto their workspace when one is created.';

alter table public.customers
  add column if not exists plan text not null default 'core'
    check (plan in ('core', 'grow', 'agency'));

-- ---------------------------------------------------------------------------
-- Everything a client record touches, in one place.
--
-- Built as a view because six screens were each running their own count and
-- getting slightly different answers about what a client has.
-- ---------------------------------------------------------------------------

create or replace view public.client_overview as
  select
    c.id,
    c.org_id,
    c.name,
    c.stage,
    c.workspace_id,
    (c.workspace_id is not null) as has_login,
    c.plan,
    (select count(*) from jobs j where j.customer_id = c.id) as engagements,
    (select count(*) from targets t where t.for_client_id = c.id) as targets,
    (select count(*) from brands b where b.customer_id = c.id) as brands,
    (select count(*) from brand_intel i
       join brands b on b.id = i.brand_id
      where b.customer_id = c.id) as documents,
    (select count(*) from customer_notes n where n.customer_id = c.id) as notes,
    (select count(*) from case_studies s where s.customer_id = c.id) as case_studies,
    (select coalesce(sum(i.total - i.amount_paid), 0)
       from job_invoices i join jobs j on j.id = i.job_id
      where j.customer_id = c.id and i.status <> 'void') as owed
  from customers c;

comment on view public.client_overview is
  'One count of what each client has, so six screens stop disagreeing about it.';
