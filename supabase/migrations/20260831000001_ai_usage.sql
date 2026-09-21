-- ============================================================================
-- WHAT THE READING ACTUALLY COSTS
-- ============================================================================
-- Two changes, pulling in opposite directions on purpose.
--
-- The cost stops being shown to the person using the product. A contractor
-- photographing a receipt does not need to be told it cost half a cent, and
-- telling them turns a feature into a meter. People behave differently around
-- a meter: they hesitate, they batch, they decide this one is not worth it.
-- That hesitation is the opposite of what the product wants, which is
-- everything in the shoebox ending up in here.
--
-- The cost starts being recorded properly, so the owner can see it. Pricing
-- this later needs the real number per business, not an estimate — which tier
-- includes how many reads is a question with a right answer, and the answer
-- is in this data.
-- ============================================================================

-- Notes extraction reported a cost and then threw it away. Documents and
-- price lists already stored theirs.
alter table public.customer_notes
  add column if not exists extraction_cost_cents numeric(10, 4);

comment on column public.customer_notes.extraction_cost_cents is
  'Measured cost of reading this note, in cents. Never shown to the person who wrote it.';

-- ---------------------------------------------------------------------------
-- One place to ask "what has this business cost us to run".
--
-- security_invoker so it obeys the same row level security as the tables
-- underneath. Nobody sees another business's usage through it.
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

comment on view ai_usage is
  'Measured cost of every document and note read, by business and month. Feeds the owner-facing usage tile and, eventually, pricing tiers.';
