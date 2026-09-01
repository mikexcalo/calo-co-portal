-- ============================================================================
-- LOCAL SEARCH
-- ============================================================================
-- For a local business, search is not the mysterious thing it is made out to
-- be. It is roughly four levers, and three of them are administrative work
-- nobody enjoys and everybody postpones.
--
--   The Google Business Profile, filled in properly
--   The same name, address and phone written identically everywhere
--   Reviews, in volume and recently
--   A website that says what it does and where it does it
--
-- None of that is clever. It is a checklist that takes an afternoon and gets
-- abandoned in the second hour, which is exactly the kind of thing software
-- should hold. So this stores the state, generates the parts that can be
-- generated, and says why each item matters, because a checklist without
-- reasons gets skipped at the first boring item.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- The canonical record.
--
-- One place that holds the name, address and phone exactly as they should
-- appear, forever, everywhere.
--
-- This sounds trivial and is the single most common local search mistake.
-- "Ste 4" on one directory and "Suite 4" on another, a cell number on Yelp and
-- an office line on Google, and search engines quietly lose confidence that
-- the listings describe the same business. Nobody sees an error. The business
-- just ranks worse than it should and never finds out why.
-- ---------------------------------------------------------------------------

create table if not exists public.seo_profile (
  org_id        uuid primary key references orgs(id) on delete cascade,

  -- Exactly as it should be written. Copied, never retyped.
  legal_name    text,
  phone         text,
  street        text,
  city          text,
  region        text,
  postcode      text,
  country       text default 'US',

  /**
   * The primary Google category, and any others.
   *
   * The primary carries most of the weight and is the one people get wrong by
   * choosing something broad. "General Contractor" competes with everybody;
   * "Bathroom Remodeler" competes with people who do the thing you do.
   */
  primary_category text,
  categories       jsonb not null default '[]'::jsonb,

  -- Towns served, which is what "near me" actually matches against.
  service_areas jsonb not null default '[]'::jsonb,
  -- What you sell, in the words somebody would type.
  services      jsonb not null default '[]'::jsonb,

  hours         jsonb not null default '{}'::jsonb,
  site_url      text,
  gbp_url       text,
  description   text,

  updated_at    timestamptz not null default now()
);

alter table public.seo_profile enable row level security;

drop policy if exists seo_profile_own on public.seo_profile;
create policy seo_profile_own on public.seo_profile
  for all to authenticated
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

-- ---------------------------------------------------------------------------
-- The checklist, with state.
--
-- Held per business rather than as a static page, because the whole value is
-- knowing which of these you have already done. A list you cannot tick is a
-- blog post.
-- ---------------------------------------------------------------------------

create table if not exists public.seo_tasks (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references orgs(id) on delete cascade,
  key        text not null,
  status     text not null default 'todo'
             check (status in ('todo', 'doing', 'done', 'skipped')),
  note       text,
  done_at    timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists seo_tasks_one_per_key
  on public.seo_tasks(org_id, key);

alter table public.seo_tasks enable row level security;

drop policy if exists seo_tasks_own on public.seo_tasks;
create policy seo_tasks_own on public.seo_tasks
  for all to authenticated
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

-- Stamp the completion date rather than asking anybody to record it.
create or replace function public.stamp_seo_done()
returns trigger language plpgsql as $function$
begin
  if new.status = 'done' and (old.status is distinct from 'done') then
    new.done_at := now();
  elsif new.status <> 'done' then
    new.done_at := null;
  end if;
  return new;
end;
$function$;

drop trigger if exists seo_tasks_stamp on public.seo_tasks;
create trigger seo_tasks_stamp
  before insert or update on public.seo_tasks
  for each row execute function public.stamp_seo_done();

-- ---------------------------------------------------------------------------
-- Directory listings.
--
-- Each one is a place the business should appear with identical details. The
-- point of tracking them is not the listing itself, it is being able to answer
-- "where have I already put this" when the phone number changes in two years
-- and every one of them needs updating.
-- ---------------------------------------------------------------------------

create table if not exists public.seo_citations (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references orgs(id) on delete cascade,
  name       text not null,
  url        text,
  status     text not null default 'todo'
             check (status in ('todo', 'claimed', 'verified', 'skipped')),
  note       text,
  created_at timestamptz not null default now()
);

create unique index if not exists seo_citations_one_per_name
  on public.seo_citations(org_id, name);

alter table public.seo_citations enable row level security;

drop policy if exists seo_citations_own on public.seo_citations;
create policy seo_citations_own on public.seo_citations
  for all to authenticated
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

comment on table public.seo_citations is
  'Every directory the business appears in. Tracked so that when the phone number changes, there is a list rather than a memory.';
