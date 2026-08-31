-- ============================================================================
-- BRANDS
-- ============================================================================
-- The brand kit lived on the org, which was right when a business had one
-- brand: its own. An agency does not. CALO&CO runs its own identity and also
-- holds the identity of every client it builds for, and those are different
-- things that happened to be stored in the same field.
--
-- The practical failure: Colette's palette, type stack and voice rules had
-- nowhere to go. Putting them on the CALO&CO org would overwrite CALO&CO's
-- own; giving Colette a whole workspace would mean provisioning a login for
-- people who are not asking for one.
--
-- So a brand is its own record, owned by the agency, optionally pointing at
-- the client it belongs to. One client can have several — a parent company
-- with sub-brands is normal and was previously unrepresentable.
--
-- Contractors are unaffected. The brand_kit module is off for them, so
-- Mammoth's screens do not change.
-- ============================================================================

create table if not exists public.brands (
  id          uuid primary key default gen_random_uuid(),
  -- The agency that manages it. Never the client's own org.
  org_id      uuid not null references orgs(id) on delete cascade,
  -- Which client it belongs to. Null means it is the agency's own brand.
  customer_id uuid references customers(id) on delete set null,

  name        text not null,
  site_url    text,

  /**
   * Everything that defines the brand, in one document.
   *
   * jsonb rather than columns because the shape genuinely varies: a
   * restaurant-tech company has integration logos and a section rhythm rule,
   * a builder has a wordmark and two colours. Forcing both into the same
   * columns would mean a table of mostly-null fields and a schema change
   * every time a client turns up with a kind of asset nobody anticipated.
   *
   * Known sections: colors, fonts, voice, assets, notes.
   */
  kit         jsonb not null default '{}'::jsonb,

  /**
   * Things that must be resolved before the work can ship. Held here rather
   * than as free text because they are the questions that get forgotten and
   * then discovered at launch: an unlicensed font, a photo nobody cleared, a
   * logo used without written permission.
   */
  open_items  jsonb not null default '[]'::jsonb,

  status      text not null default 'active'
              check (status in ('active', 'building', 'archived')),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists brands_org_idx      on public.brands(org_id);
create index if not exists brands_customer_idx on public.brands(customer_id) where customer_id is not null;

alter table public.brands enable row level security;

drop policy if exists brands_own on public.brands;
create policy brands_own on public.brands
  for all to authenticated
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

drop trigger if exists brands_updated_at on public.brands;
create trigger brands_updated_at
  before update on public.brands
  for each row execute function public.set_updated_at();

comment on table public.brands is
  'Identities an agency manages. Its own, and one or more per client. The brand kit was previously a single field on the org, which assumed every business has exactly one brand.';

comment on column public.brands.open_items is
  'Unresolved before launch: unlicensed fonts, uncleared photography, logos used without written permission. The things that are cheap now and expensive at launch.';
