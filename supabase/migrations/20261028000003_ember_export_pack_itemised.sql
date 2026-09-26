/*
  The third sent proposal, missed by the sweep before it.

  Ember & Ash ships hot sauce, so its "Export sample pack" for a trading
  company is cases and freight rather than hours. Same rule as the other two:
  every line is qty x unit_price and the lines sum to the $3,480 already on
  the estimate.
*/
insert into public.estimate_lines (estimate_id, kind, description, qty, unit, unit_price, total, position)
select e.id, v.kind, v.description, v.qty, v.unit, v.unit_price, v.total, v.position
from public.estimates e
join public.orgs o on o.id = e.org_id
cross join (values
  ('material', 'Sample pack, 12 x 150ml, full range',  40::numeric, 'cases', 54::numeric, 2160::numeric, 1),
  ('material', 'Export labelling and ingredient decks', 40,         'cases',  12,          480,          2),
  ('other',    'Pallet build and export documentation', 1,          'lot',   420,          420,          3),
  ('other',    'Freight to port, Houston',              1,          'lot',   420,          420,          4)
) as v(kind, description, qty, unit, unit_price, total, position)
where o.name = 'Ember & Ash Hot Sauce' and o.is_demo
  and e.status = 'sent'
  and e.total = 3480
  and not exists (select 1 from public.estimate_lines l where l.estimate_id = e.id);
