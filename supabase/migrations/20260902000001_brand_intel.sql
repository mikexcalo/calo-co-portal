-- ============================================================================
-- RAW INTEL, KEPT
-- ============================================================================
-- Everything you learn about a client before it has been turned into anything:
-- the discovery call, the founder's rambling voice note, the three paragraphs
-- they emailed at midnight, the about page you pulled off their old site.
--
-- Kept rather than consumed. A reader turns a transcript into proposed
-- positioning, and the proposal is wrong about a third of the time, and the
-- only way to check it is to go back to what was actually said. Throwing away
-- the source once it has been "processed" means every later disagreement is
-- settled by whoever remembers hardest.
--
-- It is also the answer to the second-year question. Somebody asks why the
-- positioning says what it says, and the answer is a dated call where the
-- founder said it in their own words.
-- ============================================================================

create table if not exists public.brand_intel (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references orgs(id) on delete cascade,
  brand_id   uuid not null references brands(id) on delete cascade,

  kind       text not null default 'note'
             check (kind in ('transcript', 'note', 'email', 'site', 'doc')),

  title      text,
  body       text not null,

  -- Who said it, or where it came from. Free text on purpose: "Frank, kickoff
  -- call" is more useful six months later than any dropdown would have been.
  source     text,
  happened_on date,

  /**
   * When a reader last looked at this, and what that cost.
   *
   * Null means it has never been read. Re-reading the same drop is paying
   * twice for the same answer, so the screen can say so rather than letting
   * somebody click it again out of uncertainty.
   */
  read_at    timestamptz,
  cost_cents numeric(8,4),

  created_at timestamptz not null default now()
);

create index if not exists brand_intel_brand_idx
  on public.brand_intel(brand_id, created_at desc);

alter table public.brand_intel enable row level security;

drop policy if exists brand_intel_own on public.brand_intel;
create policy brand_intel_own on public.brand_intel
  for all to authenticated
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

comment on table public.brand_intel is
  'Raw source material per brand, kept rather than consumed. A proposal is only checkable against what was actually said.';

-- ---------------------------------------------------------------------------
-- Where a module's content came from.
--
-- A line somebody wrote and a line a reader proposed and nobody has checked
-- are not the same thing, and after two weeks they look identical on screen.
-- The framework's own argument applies: what reads well is what ships by
-- accident.
--
-- Stored inside the messaging blob rather than as a column, because it belongs
-- to the module and there are ten of them.
-- ---------------------------------------------------------------------------

comment on column public.brands.messaging is
  'The ten framework modules, in order, each with its state, content and where that content came from. Order is not cosmetic: every module is an input to the next.';
