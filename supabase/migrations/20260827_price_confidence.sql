-- ============================================================================
-- PRICE CONFIDENCE
-- ============================================================================
-- Seeding the price list from one estimate produced numbers that LOOK
-- authoritative and aren't. $325 a sconce was true for that house, on that
-- ceiling, with that wire run. Treating it as the standard rate is how a
-- quote goes out wrong months later, and the person who finds out is a
-- customer with a signed number in their hand.
--
-- So a price item now carries how much it should be trusted:
--
--   confirmed = false  -> derived or imported, nobody has verified it
--   varies    = true   -> genuinely not one number; quote it per job
--   price_high         -> set when the honest answer is a range
--
-- Unconfirmed items are deliberately kept OUT of the estimate picker. A
-- number you can't stand behind is worse than no number, because no number
-- makes you think.
-- ============================================================================

alter table price_items add column if not exists confirmed boolean not null default false;
alter table price_items add column if not exists varies boolean not null default false;
alter table price_items add column if not exists price_high numeric(12,2);
alter table price_items add column if not exists confirmed_at timestamptz;
alter table price_items add column if not exists source_note text;

comment on column price_items.confirmed is
  'Someone who sets prices has verified this. Unconfirmed items do not appear when building an estimate.';
comment on column price_items.varies is
  'No single rate is honest for this. Prompts a per-job price rather than autofilling one.';
comment on column price_items.price_high is
  'Upper end when the real answer is a range. price_unit is then the lower end.';
comment on column price_items.source_note is
  'Where the figure came from, so its confidence can be judged later.';

create index if not exists price_items_unconfirmed_idx
  on price_items(org_id) where not confirmed;

-- Everything seeded from the Turks Cap estimate is unverified by definition.
update price_items
set confirmed = false,
    source_note = 'Derived from the 8908 Turks Cap estimate, 3 Aug 2026. Needs Mark to confirm before use.'
where source_note is null;
