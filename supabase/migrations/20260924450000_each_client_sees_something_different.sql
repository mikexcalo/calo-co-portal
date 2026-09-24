-- Three clients, three different platforms, configured the way you actually
-- would rather than all getting the contractor default.
--
-- orgs.modules is the existing per-workspace switch that /what-you-see edits.
-- Setting a module to 'off' hides it; anything not named keeps whatever the
-- business kind already decided. Nothing new is invented here.
--
-- A roofer does not pitch. A hot sauce brand does not have a day's route to
-- drive. A startup has no price list and no receipts, but lives or dies on
-- brand, pipeline and being found.

update public.orgs set modules = '{
  "pitches": "off",
  "stories": "off",
  "brand_kit": "off",
  "catalog": "off",
  "market": "off",
  "targets": "live",
  "routes": "live",
  "pricing": "live",
  "receipts": "live",
  "records": "live",
  "reviews": "live",
  "seo": "live",
  "traffic": "live"
}'::jsonb
where slug = 'harbor-light-demo';

-- Ember & Ash sell cases to distributors. The catalog IS the business, the
-- "jobs" are orders, and nobody is driving a route. Reviews matter because
-- shelf placement follows them.
update public.orgs set modules = '{
  "routes": "off",
  "receipts": "off",
  "records": "off",
  "catalog": "live",
  "pricing": "live",
  "targets": "live",
  "pitches": "live",
  "stories": "live",
  "brand_kit": "live",
  "reviews": "live",
  "seo": "live",
  "traffic": "live",
  "market": "live"
}'::jsonb
where slug = 'ember-ash-demo';

-- Tideline is a founder raising and selling. No route, no price list, no
-- receipts, no catalog — but everything about how they are seen and who they
-- are talking to.
update public.orgs set modules = '{
  "routes": "off",
  "pricing": "off",
  "receipts": "off",
  "catalog": "off",
  "records": "off",
  "reviews": "off",
  "brand_kit": "live",
  "pitches": "live",
  "stories": "live",
  "targets": "live",
  "seo": "live",
  "traffic": "live",
  "market": "live"
}'::jsonb
where slug = 'tideline-demo';

-- The studio keeps everything, the way CALO&CO does.
update public.orgs set modules = '{}'::jsonb where slug = 'northwind-studio-demo';

-- Blank Co stays exactly as a new signup finds it: no overrides at all.
