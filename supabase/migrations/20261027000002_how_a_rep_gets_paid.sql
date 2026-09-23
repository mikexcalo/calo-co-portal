-- ============================================================================
-- How a rep gets paid, and what a live price sheet has to carry.
--
-- John does not buy or sell seafood. He represents the people who do, and
-- Wide Foods pays him per pound on what moves: five cents on most of it,
-- twenty-five on crab meat. That is his entire revenue and the system had
-- nowhere to put it. Every money column here assumed you either charge by the
-- hour or charge a monthly fee.
--
-- Three things were missing from a line on a principal's sheet.
--
-- COMMISSION. Set once on the principal, overridden on the lines that differ.
-- It is per unit rather than a percentage because that is how it was quoted,
-- and a percentage field would have to be told what it is a percentage of.
--
-- WHAT IS ACTUALLY THERE. "This is a live inventory as we sell every day."
-- A rep who quotes from a sheet without stock on it sells something that went
-- yesterday, and finds out from the buyer.
--
-- WHEN IT WAS TRUE. Same reason. A price with no date on it is a price you
-- have to go and check before you can use it, which means the sheet has not
-- saved anybody anything.
-- ============================================================================

alter table public.client_products
  add column if not exists commission_per_unit numeric(10,4),
  -- Cases and pounds are both quoted, and neither implies the other without
  -- knowing the pack, which is free text because packs are.
  add column if not exists cases_available numeric(12,2),
  add column if not exists lbs_available numeric(14,2),
  add column if not exists quoted_on date;

comment on column public.client_products.commission_per_unit is
  'What this line earns, per unit. Null means fall back to the standing rate on the principal.';
comment on column public.client_products.quoted_on is
  'When the principal last said this price. A sheet with no date is a sheet you have to verify before using.';

-- The standing deal, so it is stated once rather than on two hundred rows.
alter table public.customer_terms
  add column if not exists commission_per_unit numeric(10,4),
  add column if not exists commission_note text;

comment on column public.customer_terms.commission_per_unit is
  'The standing per-unit commission this principal pays. Lines may override it.';
comment on column public.customer_terms.commission_note is
  'The deal in their words, for the cases the number does not cover.';

-- ----------------------------------------------------------------------------
-- A principal is not a customer and not a supplier.
--
-- customers.relationship offered customer, supplier or other. Wide Foods is
-- neither: money comes FROM them, which is not a supplier, and they buy
-- nothing, which is not a customer. Filed as either one, every screen that
-- reasons about direction of money gets it backwards.
-- ----------------------------------------------------------------------------
alter table public.customers
  drop constraint if exists customers_relationship_check;

alter table public.customers
  add constraint customers_relationship_check
    check (relationship in ('customer', 'supplier', 'principal', 'other'));

comment on column public.customers.relationship is
  'customer = buys from you. supplier = you buy from them. principal = you sell on their behalf and they pay you commission. other = neither.';
