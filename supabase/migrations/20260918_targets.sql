-- ============================================================================
-- TARGETS: COMPANIES YOU ARE GOING AFTER
-- ============================================================================
-- Not clients. A target is somebody who has never heard of you, and there are
-- two hundred of them.
--
-- WHY NOT JUST USE customers WITH stage = prospect
--
-- Because two hundred cold names would drown the eight people you actually
-- work with, and the client list is the screen you open every day. A prospect
-- is somebody in a conversation. A target is a row on a list you are working
-- through. Mixing them makes the useful list useless.
--
-- When a target answers, it becomes a customer and stops being a target. That
-- promotion is the only relationship between the two tables, which is what
-- keeps both honest.
-- ============================================================================

create table if not exists public.targets (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references orgs(id) on delete cascade,

  name       text not null,
  -- What kind of thing this is. Free text because every industry names its own
  -- segments and a fixed list would be wrong by the second client.
  segment    text,
  region     text,
  -- Restaurants have units, distributors have depots, agencies have offices.
  -- One number, whatever it counts.
  size       int,
  note       text,

  website    text,
  address    text,
  contact_name  text,
  contact_email text,
  contact_phone text,

  /**
   * Where this one has got to.
   *
   * researching  on the list, nobody has been contacted
   * approached   you reached out and are waiting
   * talking      there is a conversation
   * won          they became a customer
   * passed       no, or not now
   */
  status     text not null default 'researching'
             check (status in ('researching', 'approached', 'talking', 'won', 'passed')),

  -- Set when a target turns into somebody you work with, so the list can show
  -- what it produced rather than only what is left.
  customer_id uuid references customers(id) on delete set null,

  last_touch  date,
  next_step   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists targets_org_idx on public.targets(org_id, status);
create index if not exists targets_segment_idx on public.targets(org_id, segment);

-- The same company should not appear twice on one list, which is what happens
-- when two people import overlapping spreadsheets.
create unique index if not exists targets_no_duplicates
  on public.targets(org_id, lower(name));

alter table public.targets enable row level security;

drop policy if exists targets_own on public.targets;
create policy targets_own on public.targets
  for all to authenticated
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

comment on table public.targets is
  'Companies you are going after. Separate from customers because two hundred cold names would drown the eight people you actually work with.';

-- Won requires the customer it became. Otherwise "won" is a claim with nothing
-- behind it, and the list stops being able to show what it produced.
alter table public.targets drop constraint if exists targets_won_has_customer;
alter table public.targets add constraint targets_won_has_customer
  check (status <> 'won' or customer_id is not null);
