-- ============================================================================
-- CONTACT PEOPLE + PRICE CATALOG
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A customer is a company; a contact is the person you actually deal with.
-- Collapsing the two was a real gap — "Mammoth Construction" doesn't answer
-- the phone, Mark does.
-- ---------------------------------------------------------------------------

alter table customers add column if not exists contact_name text;
alter table customers add column if not exists contact_title text;

comment on column customers.contact_name is
  'The person you deal with. The customer row itself is the company.';

-- ---------------------------------------------------------------------------
-- price_items — the catalog behind estimates and invoices
--
-- A contractor already has a price list, usually in a PDF or a spreadsheet.
-- The job here is to get it in once and then never retype a line item again:
-- picking "Demo — bathroom, $850/room" beats typing it and mistyping it.
--
-- Prices live on the ORG, so Mammoth's list is Mammoth's and switching
-- businesses switches catalogs.
-- ---------------------------------------------------------------------------

create table if not exists price_items (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id) on delete cascade,

  name          text not null,
  description   text,
  category      text,

  -- What you sell it by: 'hr', 'sq ft', 'each', 'day', 'linear ft'…
  unit          text,
  unit_price    numeric(12,2) not null default 0,

  kind          text not null default 'labor'
                  check (kind in ('labor','material','subcontractor','other')),

  -- Retired items stay for history rather than being deleted, so an old
  -- estimate still shows what was actually quoted.
  active        boolean not null default true,

  -- Where it came from, when imported rather than typed
  source_document_id uuid references documents(id) on delete set null,

  position      integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists price_items_updated_at on price_items;
create trigger price_items_updated_at before update on price_items
  for each row execute function set_updated_at();

create index if not exists price_items_org_idx on price_items(org_id);
create index if not exists price_items_active_idx on price_items(org_id) where active;

alter table price_items enable row level security;

drop policy if exists price_items_org_wall on price_items;
create policy price_items_org_wall on price_items
  for all to authenticated
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

-- The agency that manages a client's site can also see their catalog, so a
-- price list can be published to the client's website.
drop policy if exists price_items_agency_read on price_items;
create policy price_items_agency_read on price_items
  for select to authenticated
  using (exists (
    select 1 from client_sites s
    where s.org_id = price_items.org_id
      and s.managed_by_org_id = current_org_id()
  ));

-- ---------------------------------------------------------------------------
-- Publish the catalog to a website.
--
-- A public read of the items a business has explicitly marked publishable,
-- so their marketing site can render a live price list instead of one that
-- drifts out of date the week after it's written.
-- ---------------------------------------------------------------------------

alter table price_items add column if not exists public boolean not null default false;

comment on column price_items.public is
  'Show this item on the public price list for the business''s website.';
