-- Two objects a sales agency needs and this system did not have.
--
-- John sells other people's seafood on commission. His world has four kinds of
-- thing, and two of them already exist here: the principals he represents are
-- Clients, and the distributors he sells to are Pipeline. The two that were
-- missing are the product list and the market knowledge, and the difference
-- between them is what decides where each one lives.
--
-- A PRODUCT LIST BELONGS TO SOMEBODY
--
-- Pacific Empress raw P&D tail-off 21/25 and Mardex raw P&D tail-off 21/25 are
-- the same string and different objects, because the price and the FOB point
-- differ, and that difference is the entire point of a price sheet. So the
-- catalog hangs off the client record. A top-level product screen would have to
-- open by asking which client you meant, and a screen whose first act is asking
-- what you meant should not be top-level.
--
-- MARKET KNOWLEDGE BELONGS TO NOBODY
--
-- That P&D tail-off is 36% of the shrimp market is true whichever principal he
-- is selling for. Filed under one client, it is either copied or lost the day he
-- signs a fourth, and copied reference goes stale in one direction only:
-- silently. So it sits at the top level, owned by the business rather than by a
-- client on it.
--
-- WHY THE LIBRARY HAS NO SCHEMA
--
-- The obvious build is a table of species, origins and star ratings. There is
-- exactly one document to design it from, John has already promised the next
-- one, and the next one is a shrimp matrix with counts and forms rather than
-- countries and species, so a squid-shaped schema breaks on arrival. And the
-- value is not the numbers. It is "I would avoid Peru" and "do not move on squid
-- until anchor distribution", which no rating column carries and which is the
-- part a distributor is paying him for. Documents, kept whole and searchable.

-- ---------------------------------------------------------------- catalog ---

create table if not exists client_products (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id) on delete cascade,
  customer_id   uuid not null references customers(id) on delete cascade,

  -- John's six columns, in his words. He wrote the schema in the email
  -- without being asked, which is the strongest signal a table is real.
  item          text not null,
  form          text,          -- the cut. P&D TON, T&T, rings only.
  size          text,          -- count for shrimp, inches for squid.
  pack          text,          -- 5 x 4 lb, 10 kg, and so on.
  price         numeric(12,4), -- per unit, null until the principal quotes it.
  unit          text default 'lb',
  fob           text,          -- where the price is good from.

  -- Two more, because seafood is sold on them and a species and an origin are
  -- not a note. Ignored by any business that does not need them.
  origin        text,
  species       text,

  -- Where it sells, in his own shorthand: Mexican/Latin/Asian, Steakhouse,
  -- Fine Dining/Mediterranean/Italian.
  sells_to      text,
  note          text,

  -- Ten priority SKUs is an ordered list, and alphabetical would destroy the
  -- ordering that is the whole point of calling them priority.
  sort          integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists client_products_customer on client_products (customer_id, sort);
alter table client_products enable row level security;

drop policy if exists client_products_own on client_products;
create policy client_products_own on client_products
  for all using (org_id = current_org_id()) with check (org_id = current_org_id());

-- ---------------------------------------------------------------- library ---

create table if not exists reference_docs (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id) on delete cascade,

  title         text not null,
  -- One word for what it is about, so a growing library stays scannable.
  -- Shrimp, Squid, Finfish. Free text on purpose: the categories are the
  -- business's, not ours.
  subject       text,
  -- Where it came from, named. An unattributed market share is a rumor, and
  -- the difference matters when somebody quotes it back at a buyer.
  source        text,
  -- When the underlying data is from, which is not when it was typed in.
  as_of         date,
  body          text not null,

  -- Almost always null. Set only when a document really is about one client
  -- and would mislead if read as general.
  customer_id   uuid references customers(id) on delete set null,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists reference_docs_org on reference_docs (org_id, subject);
alter table reference_docs enable row level security;

drop policy if exists reference_docs_own on reference_docs;
create policy reference_docs_own on reference_docs
  for all using (org_id = current_org_id()) with check (org_id = current_org_id());

-- ------------------------------------------------------- John's own lists ---

-- The 104 distributors move to John.
--
-- They were loaded into CALO&CO tagged for_client_id = Global Seafood, which
-- was the only place to put them before he had a workspace. They are his
-- accounts, he now has somewhere to keep them, and two copies of a pipeline
-- diverge the first week somebody works one of them. for_client_id goes null
-- because in his workspace they are not for a client, they are the pipeline.
update targets
   set org_id = (select id from orgs where slug = 'global-seafood'),
       for_client_id = null
 where for_client_id = (
         select id from customers
          where name = 'Global Seafood Partners'
            and org_id = (select id from orgs where slug = 'calo-co')
       );

-- Pipeline, the catalog and the library go on for him.
update orgs
   set modules = modules || '{"targets":"live","catalog":"live","market":"live"}'::jsonb
 where slug = 'global-seafood';

update customers
   set modules = modules || '{"targets":"live","catalog":"live","market":"live"}'::jsonb
 where name = 'Global Seafood Partners'
   and org_id = (select id from orgs where slug = 'calo-co');
