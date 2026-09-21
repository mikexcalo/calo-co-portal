-- Two things a list needs before anybody can work it.
--
-- DUPLICATES
--
-- There was no unique index on a company name, so a second import of the same
-- spreadsheet would silently double the list. A CRM that quietly grows copies
-- of its own records is one people stop trusting inside a month, and by then
-- the merge is manual. Cheaper to refuse the write.
--
-- Case insensitive, because "City Line Distributors" and "City line
-- distributors" are the same company to everybody except a database.
--
-- SAVED VIEWS
--
-- Filters lived in component state and reset the moment you navigated, so
-- "Northeast independents I have not called in a month" had to be rebuilt every
-- morning. Rebuilding that view is not preparation for the work, it IS the
-- work, and charging for it in clicks every single day is the largest tax this
-- product levies.
--
-- Deliberately not a query builder. A view is the filter state the screen
-- already holds, given a name, so adding one costs a person nothing they were
-- not already doing.

create unique index if not exists customers_one_name_each
  on customers (org_id, lower(name));

create table if not exists saved_views (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  -- Which screen it belongs to. A view of the pipeline is meaningless on the
  -- people list, and offering it there is how a good idea becomes clutter.
  screen      text not null check (screen in ('pipeline', 'clients', 'people')),
  name        text not null,
  -- The filter state, exactly as the screen holds it. Stored whole rather than
  -- as columns, because the shape belongs to the screen and pinning it into a
  -- schema means a migration every time a filter is added.
  filters     jsonb not null default '{}',
  -- Sits in the sidebar of that screen, in an order the person chose.
  sort        integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists saved_views_org on saved_views (org_id, screen, sort);
alter table saved_views enable row level security;

drop policy if exists saved_views_own on saved_views;
create policy saved_views_own on saved_views
  for all using (org_id = current_org_id()) with check (org_id = current_org_id());

comment on table saved_views is
  'A named filter set per screen. Not a query builder: it stores what the screen already had, so saving costs nothing.';
