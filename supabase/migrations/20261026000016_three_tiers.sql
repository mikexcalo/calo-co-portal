-- ============================================================================
-- THREE TIERS, WRITTEN DOWN
-- ============================================================================
-- The rate was living in two columns on customer_terms: hourly_rate, what this
-- customer actually pays, and standard_rate, what they would have paid. That
-- records a discount but not a price list — "why 60" was answerable only as
-- "because it says 60 here", and there was nowhere to put a third number.
--
-- A tier is the thing being discounted FROM. Naming them makes the discount
-- legible on a proposal: a customer is on a tier, and where their rate is
-- below it, the reason is already recorded in why_discounted.
--
-- Mike's three: friends and family at $60, standard at $120, enterprise at
-- $180. John and Mark are both on friends and family, which is what their
-- existing $60/$120 pair already meant.
-- ============================================================================

create table if not exists rate_tiers (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  key         text not null,
  name        text not null,
  hourly_rate numeric(10,2) not null,
  blurb       text,
  sort        int  not null default 0,
  created_at  timestamptz not null default now(),
  unique (org_id, key)
);

create index if not exists rate_tiers_org_idx on rate_tiers(org_id, sort);

alter table rate_tiers enable row level security;

-- The same wall as everything else: your own business, and only while the
-- session is fully signed in. current_org_id() returns null otherwise, and a
-- null on the right of = matches nothing.
drop policy if exists rate_tiers_own on rate_tiers;
create policy rate_tiers_own on rate_tiers
  for all to authenticated
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

comment on table rate_tiers is
  'An org''s price list. What a customer is charged lives on customer_terms; this is what they are charged against.';

-- ---------------------------------------------------------------------------
-- Which tier a customer sits on.
-- ---------------------------------------------------------------------------

alter table customer_terms
  add column if not exists rate_tier_id uuid references rate_tiers(id) on delete set null;

comment on column customer_terms.rate_tier_id is
  'The published tier this customer was priced against. hourly_rate may sit below it; why_discounted says why.';

-- ---------------------------------------------------------------------------
-- CALO&CO's three.
--
-- Seeded by name rather than by hardcoded id so this is safe to re-run, and
-- scoped to the one org that has a price list. Nobody else's rates are
-- invented here — an org with no tiers shows no tiers.
-- ---------------------------------------------------------------------------

insert into rate_tiers (org_id, key, name, hourly_rate, blurb, sort)
select o.id, v.key, v.name, v.rate, v.blurb, v.sort
from orgs o
cross join (values
  ('friends',    'Friends and family', 60.00,
   'People who backed this before it worked. Held at half standard, by choice, and not offered publicly.', 1),
  ('standard',   'Standard',          120.00,
   'The published rate for ordinary work — a business with a site, a pipeline and somebody to answer to.', 2),
  ('enterprise', 'Enterprise',        180.00,
   'Work carrying a deadline somebody else set, an integration nobody controls, or a room that needs reporting.', 3)
) as v(key, name, rate, blurb, sort)
where o.name = 'CALO&CO'
on conflict (org_id, key) do update
  set name        = excluded.name,
      hourly_rate = excluded.hourly_rate,
      blurb       = excluded.blurb,
      sort        = excluded.sort;

-- Point the two existing customers at the tier their numbers already implied.
update customer_terms t
set rate_tier_id = rt.id
from rate_tiers rt
where rt.org_id = t.org_id
  and rt.key = 'friends'
  and t.rate_tier_id is null
  and t.hourly_rate = 60.00;
