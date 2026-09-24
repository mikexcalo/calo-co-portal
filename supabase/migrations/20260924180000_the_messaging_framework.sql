-- One messaging framework, used for every brand.
--
-- What was here: six free-text boxes on orgs.settings.message, for your own
-- brand and nowhere else. A client's brand row held colors, fonts and logos
-- and had no opinion about what the business SAYS — so the part of the work
-- that every pitch, proposal and homepage is written out of lived in a jsonb
-- blob on one org and simply did not exist for the three clients.
--
-- The framework is the one Mike already runs on paper: six statements that
-- narrow from a promise down to an elevator pitch, then three pillars, each
-- with a headline value prop and the proof that pays it off. Pillars are
-- jsonb because three is the convention, not a constraint.
--
-- brand_id null means your own. NULLS NOT DISTINCT so the unique index is
-- inferrable by onConflict — the thing that quietly broke seo_tasks for
-- months, applied on purpose this time.

create table if not exists public.brand_message (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.orgs(id) on delete cascade,
  brand_id     uuid references public.brands(id) on delete cascade,

  promise      text,   -- the shortest true thing
  positioning  text,   -- category, who for, what is different
  audience     text,   -- specific enough to exclude somebody
  mission      text,   -- why the business exists
  tone         text,   -- how it sounds out loud
  elevator     text,   -- the full answer, said once

  /* [{ name, headline, support: [text, ...] }] */
  pillars      jsonb not null default '[]'::jsonb,

  updated_at   timestamptz not null default now()
);

create unique index if not exists brand_message_one_per_brand
  on public.brand_message (org_id, brand_id)
  nulls not distinct;

alter table public.brand_message enable row level security;

drop policy if exists brand_message_org_wall on public.brand_message;
create policy brand_message_org_wall on public.brand_message
  for all using (org_id = current_org_id()) with check (org_id = current_org_id());

comment on table public.brand_message is
  'What a brand says about itself. One row per brand; brand_id null is your own.';
