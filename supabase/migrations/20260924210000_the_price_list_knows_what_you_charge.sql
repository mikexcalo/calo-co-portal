-- The Price List was blank while five prices sat elsewhere in the same
-- database, agreed and in use.
--
-- rate_tiers has held Standard $120, Friends and family $60 and Enterprise
-- $180 since 21 September. customer_terms has Hosting at $20 a month and
-- Platform use at $20 a month, on both live clients. Every one of those is a
-- real number somebody decided; none of them had ever reached the one screen
-- called "What you charge".
--
-- Seeded from those rows and nowhere else. There is no price here for a
-- website build, a brand or a retainer, because no such number exists on the
-- record and a plausible invented one is worse than a blank — it gets quoted.
--
-- confirmed = true, because these were not extracted from a document and
-- guessed at. They are the agreed figures, copied across.

insert into public.price_items
  (org_id, name, description, category, unit, unit_price, kind, active, confirmed, confirmed_at, position, source_note)
select
  '3404f233-379d-4fa9-95b8-9b37a8dd8634', v.name, v.description, v.category,
  v.unit, v.unit_price, v.kind, true, true, now(), v.position, v.source_note
from (values
  ('Standard rate',
   'The published rate for ordinary work: a business with a site, a pipeline and somebody to answer to.',
   'Time', 'hour', 120.00, 'labor', 1, 'From rate tiers'),

  ('Friends and family rate',
   'People who backed this before it worked. Held at half standard, by choice, and not offered publicly.',
   'Time', 'hour', 60.00, 'labor', 2, 'From rate tiers'),

  ('Enterprise rate',
   'Work carrying a deadline somebody else set, an integration nobody controls, or a room that needs reporting.',
   'Time', 'hour', 180.00, 'labor', 3, 'From rate tiers'),

  ('Hosting',
   'Their site, hosted and kept up. Billed on the 1st.',
   'Monthly', 'month', 20.00, 'other', 4, 'From what John and Mark already pay'),

  ('Platform use',
   'Their own workspace in here: clients, jobs, invoices, documents. Billed on the 1st.',
   'Monthly', 'month', 20.00, 'other', 5, 'From what John and Mark already pay')
) as v(name, description, category, unit, unit_price, kind, position, source_note)
where not exists (
  select 1 from public.price_items p
   where p.org_id = '3404f233-379d-4fa9-95b8-9b37a8dd8634'
     and p.name = v.name
);
