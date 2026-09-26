/*
  Demo data that can actually demonstrate the documents.

  The two customer-facing pages read a business's own phone, address and
  payment methods, and not one demo business had any of them - so the header
  had no number, the invoice had no way to pay, and every sent proposal
  rendered "priced as a whole" because none of them had a single line.

  Demo workspaces only. Mammoth Construction has four payment methods enabled
  with an empty handle on every one, which is the same bug this fixes, but it
  is a real workspace and is left alone. It is written up in the report
  instead.

  Everything below is invented and says so: fictional streets, 555 numbers,
  example.com handles. The one number that is not invented is Harbor Light's
  re-roof total, which stays at $24,680 - the lines are built to sum to
  exactly what the estimate already said.
*/

-- ── Who these businesses are ───────────────────────────────────────────────
update public.orgs set settings = settings
  || jsonb_build_object('phone', '(512) 555-0147', 'address', 'Austin, TX')
  where name = 'Harbor Light Roofing' and is_demo;

update public.orgs set settings = settings
  || jsonb_build_object('phone', '(207) 555-0168', 'address', 'Portland, ME')
  where name = 'Tideline' and is_demo;

update public.orgs set settings = settings
  || jsonb_build_object('phone', '(512) 555-0132', 'address', 'Austin, TX')
  where name = 'Ember & Ash Hot Sauce' and is_demo;

update public.orgs set settings = settings
  || jsonb_build_object('phone', '(512) 555-0109', 'address', 'Austin, TX')
  where name = 'Northwind Studio' and is_demo;

/*
  Blank Co gets them too, because the brief says every demo business and
  because a phone number is setup rather than activity - the workspace is
  still empty of work, which is the whole point of that demo.
*/
update public.orgs set settings = settings
  || jsonb_build_object('phone', '(512) 555-0175', 'address', 'Austin, TX')
  where name = 'Blank Co' and is_demo;

-- ── How their customers can pay ────────────────────────────────────────────
/*
  Deliberately not Stripe. `needsStripe` means a connected account, payLink
  has no branch for it, and switching it on without one is how you get a Pay
  button that cannot take a payment. These are the methods that work the day
  you type a handle in, which is also what these two businesses would
  realistically use.
*/
update public.orgs set payment_methods = '[
  {"id": "venmo", "handle": "@harbor-light-roofing", "enabled": true},
  {"id": "check", "handle": "1400 E 6th St, Austin, TX 78702", "enabled": true},
  {"id": "bank",  "handle": "Call the office and we will send account details", "enabled": true}
]'::jsonb
  where name = 'Harbor Light Roofing' and is_demo;

update public.orgs set payment_methods = '[
  {"id": "paypal", "handle": "billing@tideline.example", "enabled": true},
  {"id": "bank",   "handle": "Email billing@tideline.example for account details", "enabled": true}
]'::jsonb
  where name = 'Tideline' and is_demo;

-- ── What the sent proposals actually contain ───────────────────────────────
/*
  Every line's total is qty x unit_price, and the lines sum to the estimate
  total that was already on the record. A proposal whose parts do not add up
  to its own headline is worse than one with no parts at all.
*/
insert into public.estimate_lines (estimate_id, kind, description, qty, unit, unit_price, total, position)
select e.id, v.kind, v.description, v.qty, v.unit, v.unit_price, v.total, v.position
from public.estimates e
join public.orgs o on o.id = e.org_id
cross join (values
  ('labor',        'Tear-off and disposal, 2 layers',         1::numeric, 'lot',     4200::numeric,  4200::numeric, 1),
  ('material',     'Synthetic underlayment and ice shield',   38,         'squares',    90,          3420,          2),
  ('material',     'Architectural shingles, installed',       38,         'squares',   310,         11780,          3),
  ('material',     'Flashing and drip edge',                  1,          'lot',      1880,          1880,          4),
  ('material',     'Ridge vent',                              50,         'ft',         23,          1150,          5),
  ('subcontractor','Seamless gutters, loading side',          120,        'ft',         15,          1800,          6),
  ('other',        'City permit and inspection',              1,          '',          450,           450,          7)
) as v(kind, description, qty, unit, unit_price, total, position)
where o.name = 'Harbor Light Roofing' and o.is_demo
  and e.status = 'sent'
  and e.total = 24680
  and not exists (select 1 from public.estimate_lines l where l.estimate_id = e.id);

insert into public.estimate_lines (estimate_id, kind, description, qty, unit, unit_price, total, position)
select e.id, v.kind, v.description, v.qty, v.unit, v.unit_price, v.total, v.position
from public.estimates e
join public.orgs o on o.id = e.org_id
cross join (values
  ('other', 'Pilot licence, eight weeks',                    15::numeric, 'seats',    320::numeric, 4800::numeric, 1),
  ('labor', 'Onboarding and data import',                    1,           'lot',     2400,          2400,          2),
  ('labor', 'Training, four sessions with your dispatchers', 4,           'sessions', 350,          1400,          3),
  ('other', 'Named support contact for the pilot',           1,           'lot',     1000,          1000,          4)
) as v(kind, description, qty, unit, unit_price, total, position)
where o.name = 'Tideline' and o.is_demo
  and e.status = 'sent'
  and e.total = 9600
  and not exists (select 1 from public.estimate_lines l where l.estimate_id = e.id);
