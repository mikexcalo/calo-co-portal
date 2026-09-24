-- Standard $120, Friends and family $60, Enterprise $180 are not three things
-- you sell. They are one thing — an hour of your time — at three tiers, and
-- listing them as three rows has two costs.
--
-- Adding a second service means adding three more rows, so the list grows by
-- the product of services and tiers rather than by services. And nothing ties
-- the three together, so they drift: change the standard rate and the other
-- two quietly stop being half and one and a half of it.
--
-- A service is a row. A tier is a column.
--
-- tier_prices is keyed by rate_tiers.key. A tier missing from it falls back to
-- unit_price, which is what hosting wants: it costs what it costs whoever is
-- buying, and showing the same figure across all three is information — it
-- says the discount is on your time, not on your costs.

alter table public.price_items
  add column if not exists tier_prices jsonb not null default '{}'::jsonb;

comment on column public.price_items.tier_prices is
  'Price per rate tier, keyed by rate_tiers.key. A tier not listed here is '
  'charged unit_price. Empty means the price does not vary by tier.';

do $$
declare o uuid := '3404f233-379d-4fa9-95b8-9b37a8dd8634';
begin
  -- Standard becomes the one row for time, carrying all three tiers.
  update public.price_items
     set name        = 'Time',
         description = 'An hour of the work itself. Which tier a client is on '
                       'is on their record, so a proposal picks the right one.',
         unit_price  = 120.00,
         tier_prices = '{"friends": 60, "standard": 120, "enterprise": 180}'::jsonb,
         source_note = 'From rate tiers'
   where org_id = o and name = 'Standard rate';

  -- The other two were the same service at a different number.
  delete from public.price_items
   where org_id = o and name in ('Friends and family rate', 'Enterprise rate');
end $$;
