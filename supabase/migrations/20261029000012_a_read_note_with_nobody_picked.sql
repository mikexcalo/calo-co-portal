-- ============================================================================
-- A NOTE THAT HAS BEEN READ, WITH NOBODY PICKED
-- ============================================================================
-- The Notes screen labels its picker "Who is this about? · optional" and then
-- writes customer_id into a NOT NULL column, so leaving it blank has always
-- failed. Two things followed from that.
--
-- The obvious one: the words could not be kept. `drops` is already the answer
-- and DropIt already uses it, so the fix is in the app, not here.
--
-- The one worth a migration: extraction_cost_cents is recorded on that path
-- and nowhere else for a note, and that path is the one that fails. So the
-- measured cost of reading a note has most likely never been written at all.
-- Sending the note to `drops` instead only helps if the cost goes with it,
-- otherwise the fix quietly keeps the hole open.
--
-- The column, not `meta`. `meta` says of itself "never anything that costs per
-- read", which is exactly what this is. It is the same fact `documents` and
-- `customer_notes` already carry under the same name.
-- ============================================================================

alter table public.drops
  add column if not exists extraction_cost_cents numeric(10, 4);

comment on column public.drops.extraction_cost_cents is
  'Measured cost of reading this drop, in cents, when something read it before it was filed. Never shown to the person who wrote it. Same column and same units as documents and customer_notes.';

-- ---------------------------------------------------------------------------
-- The usage view has to see it too, or Overheads under-reports.
--
-- A read note in the inbox is a read note. It counts as 'note' rather than a
-- third kind: the tile says "Reading documents and notes" and how the product
-- happened to file the words is not a category of spend.
--
-- Columns, names and order are unchanged - org_id, month, kind, reads, cents,
-- dollars - because CREATE OR REPLACE VIEW cannot reorder or rename them. Only
-- the CTE underneath gains a branch.
-- ---------------------------------------------------------------------------

create or replace view ai_usage
with (security_invoker = true)
as
with reads as (
  select
    org_id,
    created_at,
    'document'::text                     as kind,
    coalesce(extraction_cost_cents, 0)   as cents
  from documents
  where extraction_cost_cents is not null

  union all

  select
    org_id,
    created_at,
    'note'::text,
    coalesce(extraction_cost_cents, 0)
  from customer_notes
  where extraction_cost_cents is not null

  union all

  -- A note nobody had picked a subject for yet. Filing it later moves it onto
  -- a record and does not change what the reading cost, so this counts it from
  -- the moment it arrived and keeps counting it afterwards.
  select
    org_id,
    created_at,
    'note'::text,
    coalesce(extraction_cost_cents, 0)
  from drops
  where extraction_cost_cents is not null
)
select
  org_id,
  date_trunc('month', created_at)::date          as month,
  kind,
  count(*)                                       as reads,
  round(sum(cents)::numeric, 2)                  as cents,
  round((sum(cents) / 100)::numeric, 2)          as dollars
from reads
group by org_id, date_trunc('month', created_at), kind;

-- CREATE OR REPLACE VIEW drops the view's options, and this one leaking
-- security_invoker is how every customer was visible to every client for
-- twenty minutes on 24 September. Set above and re-asserted here so a future
-- replace that forgets the inline clause still cannot run as owner.
alter view ai_usage set (security_invoker = true);

comment on view ai_usage is
  'Measured cost of every document and note read, by business and month, including notes still waiting in Drops. Feeds the owner-facing usage tile and, eventually, pricing tiers.';
