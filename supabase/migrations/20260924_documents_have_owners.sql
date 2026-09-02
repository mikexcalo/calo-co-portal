-- ============================================================================
-- DOCUMENTS BELONG TO SOMEBODY, AND NOT ALWAYS TO A BRAND
-- ============================================================================
-- brand_intel required a brand, which was right when the only documents were
-- discovery calls feeding a positioning framework. It is wrong the moment a
-- client hands over something that has nothing to do with their brand:
-- Mammoth's business priorities, John's incorporation plan, a price sheet from
-- a supplier.
--
-- So a document hangs off a client, and off a brand only when it is actually
-- about the brand.
--
-- WHO IS ALLOWED TO SEE IT
--
-- Three cases, all real:
--
--   ours    working notes, ranking, internal reasoning. They never see it.
--   shared  both of you reference it. Their answers, the plan you agreed.
--   theirs  their document, held here for them. You are its custodian rather
--           than its author.
--
-- Recorded rather than assumed, because the assumption people make when a
-- system is silent is that everything is shareable, and that assumption is
-- only wrong once.
-- ============================================================================

alter table public.brand_intel
  add column if not exists customer_id uuid references customers(id) on delete cascade;

-- Backfill from the brand each document already hangs off, so nothing is
-- orphaned before the column becomes the one that matters.
update public.brand_intel i
   set customer_id = b.customer_id
  from public.brands b
 where i.brand_id = b.id
   and i.customer_id is null;

-- A document about a client but not about their brand is now expressible.
alter table public.brand_intel
  alter column brand_id drop not null;

alter table public.brand_intel
  add column if not exists visibility text not null default 'ours'
    check (visibility in ('ours', 'shared', 'theirs'));

comment on column public.brand_intel.visibility is
  'ours: internal, they never see it. shared: both of you reference it. theirs: their document, held here for them. Defaults to ours, because the assumption people make when a system is silent is that everything is shareable, and that is only wrong once.';

/**
 * Where the live copy lives, when there is one.
 *
 * What is stored here is what was received, dated and unchanged: the version
 * you were reading when you made a decision. A document that is still being
 * edited lives somewhere it can be edited, and this points at it.
 *
 * Keeping both is deliberate. One snapshot and one live link answer different
 * questions, and collapsing them into one loses whichever question you were
 * not asking at the time.
 */
alter table public.brand_intel
  add column if not exists live_url text;

comment on column public.brand_intel.live_url is
  'The editable copy, wherever it lives. What is stored here is the version received on a date; this is what it says now.';

create index if not exists brand_intel_customer_idx
  on public.brand_intel(customer_id, created_at desc);

-- A document belongs to somebody. Without this it is a file in a drawer with
-- no drawer.
alter table public.brand_intel drop constraint if exists brand_intel_belongs_to_someone;
alter table public.brand_intel add constraint brand_intel_belongs_to_someone
  check (customer_id is not null or brand_id is not null);

comment on table public.brand_intel is
  'Documents held for a client. Source material kept as received, with an overview above it and a note of who may see it.';
