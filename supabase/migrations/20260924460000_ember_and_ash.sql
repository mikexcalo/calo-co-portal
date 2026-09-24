-- Ember & Ash Hot Sauce: a one-person brand selling wholesale to distributors.
--
-- Shaped like the business actually is. The "clients" are distributors and
-- grocery buyers, not consumers. The "jobs" are purchase orders. The catalog
-- is the product line, which is the thing the whole business turns on. The
-- pitches are how she gets on a new shelf.
--
-- All @example.com.

set local search_path = public, extensions;

do $$
declare
  o uuid;
  d_pintail uuid; d_fairweather uuid; d_solstice uuid; d_marisol uuid;
  po_pintail uuid; po_fair uuid; po_sol uuid;
  inv1 uuid; inv2 uuid;
begin
  select id into o from public.orgs where slug = 'ember-ash-demo';
  if o is null or exists (select 1 from public.customers where org_id = o) then
    raise notice 'nothing to do'; return;
  end if;

  -- ── Who she sells to ───────────────────────────────────────────────────
  insert into public.customers (org_id, name, contact_name, contact_title, email, phone, address, stage, relationship, tags, brief)
  values (o,'Pintail Provisions','Ruth Okafor','Category buyer','ruth@example.com','(512) 555-0210','1400 E 6th St, Austin, TX','won','customer',array['distributor','southwest'],
    jsonb_build_object(
      'opportunity','Regional specialty distributor, 140 independent grocers across Texas and New Mexico.',
      'offer','Full line, six SKUs, delivered on their truck out of the Austin depot.',
      'buyers','Ruth signs. Her category review is February and August, and nothing moves in between.',
      'economics','Roughly 220 cases a quarter at $58 a case wholesale.',
      'constraints','Needs 12 weeks notice on any label change and will not take shorter than 90 days of shelf life.'))
  returning id into d_pintail;

  insert into public.customers (org_id, name, contact_name, contact_title, email, phone, address, stage, relationship, tags)
  values (o,'Fairweather Market Group','Beto Alarcón','Grocery director','beto@example.com','(512) 555-0223','3300 N Lamar Blvd, Austin, TX','won','customer',array['grocery','chain'])
  returning id into d_fairweather;

  insert into public.customers (org_id, name, contact_name, contact_title, email, phone, stage, relationship, tags)
  values (o,'Solstice Natural Foods','Nadia Brandt','Owner','nadia@example.com','(512) 555-0244','proposed','customer',array['independent'])
  returning id into d_solstice;

  insert into public.customers (org_id, name, contact_name, email, phone, stage, relationship, tags)
  values (o,'Marisol Trading Co','Hector Vidal','hector@example.com','(512) 555-0255','talking','customer',array['distributor','export'])
  returning id into d_marisol;

  insert into public.customer_contacts (org_id, customer_id, name, title, email, phone, is_primary) values
    (o,d_pintail,'Ruth Okafor','Category buyer','ruth@example.com','(512) 555-0210', true),
    (o,d_pintail,'Chris Nkemdirim','Logistics','chris@example.com','(512) 555-0211', false),
    (o,d_fairweather,'Beto Alarcón','Grocery director','beto@example.com','(512) 555-0223', true),
    (o,d_solstice,'Nadia Brandt','Owner','nadia@example.com','(512) 555-0244', true),
    (o,d_marisol,'Hector Vidal',null,'hector@example.com','(512) 555-0255', true);

  -- ── The product line ───────────────────────────────────────────────────
  -- The catalog hangs off a customer, because on a client record it answers
  -- "what does this one carry". So the line is recorded per distributor:
  -- Pintail takes everything, Fairweather started with two.
  insert into public.client_products (org_id, customer_id, item, form, pack, size, unit, price, cases_available, note, sort) values
    (o, d_pintail,'Ember & Ash Original','Hot sauce','12 x 5oz','5 oz','case', 58.00, 340,'The one that sells. Chipotle and ancho.',1),
    (o, d_pintail,'Ember & Ash Verde','Hot sauce','12 x 5oz','5 oz','case', 58.00, 180,'Tomatillo and serrano. Second best seller.',2),
    (o, d_pintail,'Ember & Ash Reaper','Hot sauce','12 x 5oz','5 oz','case', 64.00,  95,'Limited run. Sells out every time.',3),
    (o, d_pintail,'Ember & Ash Smoked Salt','Seasoning','24 x 4oz','4 oz','case', 72.00, 120,'Higher margin than the sauces.',4),
    (o, d_pintail,'Gift trio','Gift set','6 x 3pk','3 x 5oz','case', 96.00,  60,'Q4 only. Made to order.',5),
    (o, d_pintail,'Original, food service','Hot sauce','4 x 1gal','1 gal','case',112.00,  40,'Restaurants and the two taco chains.',6),
    (o, d_fairweather,'Ember & Ash Original','Hot sauce','12 x 5oz','5 oz','case', 58.00, 340,'Twelve stores to start.',1),
    (o, d_fairweather,'Ember & Ash Verde','Hot sauce','12 x 5oz','5 oz','case', 58.00, 180,'Twelve stores to start.',2),
    (o, d_solstice,'Ember & Ash Original','Hot sauce','12 x 5oz','5 oz','case', 58.00, 340,'Opening order.',1),
    (o, d_solstice,'Ember & Ash Verde','Hot sauce','12 x 5oz','5 oz','case', 58.00, 180,'Opening order.',2),
    (o, d_solstice,'Ember & Ash Smoked Salt','Seasoning','24 x 4oz','4 oz','case', 72.00, 120,'Opening order.',3);

  insert into public.price_items (org_id, name, description, category, unit, unit_price, kind, active, confirmed, confirmed_at, position) values
    (o,'Original, wholesale case','12 x 5oz.','Wholesale','case', 58.00,'material',true,true,now(),1),
    (o,'Verde, wholesale case','12 x 5oz.','Wholesale','case', 58.00,'material',true,true,now(),2),
    (o,'Reaper, wholesale case','12 x 5oz, limited.','Wholesale','case', 64.00,'material',true,true,now(),3),
    (o,'Smoked salt, wholesale case','24 x 4oz.','Wholesale','case', 72.00,'material',true,true,now(),4),
    (o,'Pallet freight, in state','Up to 24 cases.','Freight','pallet', 185.00,'other',true,true,now(),5),
    (o,'New label setup','Artwork and plate change for a private label run.','One-off','each', 450.00,'other',true,true,now(),6);

  -- ── Orders, which are this business's jobs ─────────────────────────────
  insert into public.jobs (org_id, customer_id, name, status, billing_type)
  values (o,d_pintail,'PO 4471, Q3 restock, 220 cases','complete','fixed') returning id into po_pintail;
  insert into public.jobs (org_id, customer_id, name, status, billing_type)
  values (o,d_fairweather,'PO 118, first order, 12 stores','complete','fixed') returning id into po_fair;
  insert into public.jobs (org_id, customer_id, name, status, billing_type)
  values (o,d_solstice,'Opening order, 18 cases','won','fixed') returning id into po_sol;
  insert into public.jobs (org_id, customer_id, name, status, billing_type)
  values (o,d_marisol,'Export sample pack','lead','fixed');

  -- ── Proposals ──────────────────────────────────────────────────────────
  insert into public.estimates (org_id, job_id, status, total, base_total, sent_at, sent_to, viewed_at, decided_at, decided_by_name, decided_via, intro) values
    (o, po_sol,'accepted', 1044.00, 1044.00, now() - interval '11 days','nadia@example.com', now() - interval '10 days', now() - interval '9 days','Nadia Brandt','email',
     'Opening order for Solstice. Six cases each of Original, Verde and Smoked Salt.'),
    (o, po_pintail,'accepted', 12760.00, 12760.00, now() - interval '70 days','ruth@example.com', now() - interval '69 days', now() - interval '68 days','Ruth Okafor','platform',
     'Q3 restock across the full line.');

  insert into public.estimates (org_id, job_id, status, total, base_total, sent_at, sent_to, viewed_at, intro)
  select o, j.id,'sent', 3480.00, 3480.00, now() - interval '3 days','hector@example.com', now() - interval '1 day',
    'Sample pack and landed cost for the Monterrey route.'
    from public.jobs j where j.org_id=o and j.name='Export sample pack';

  -- ── Invoices ───────────────────────────────────────────────────────────
  insert into public.job_invoices (org_id, job_id, number, status, subtotal, total, amount_paid, issued_on, due_on, paid_at)
  values (o, po_pintail,'EA-0088','paid', 12760.00, 12760.00, 12760.00, current_date - 62, current_date - 32, now() - interval '35 days')
  returning id into inv1;

  insert into public.job_invoices (org_id, job_id, number, status, subtotal, total, amount_paid, issued_on, due_on)
  values (o, po_fair,'EA-0089','sent', 4176.00, 4176.00, 0, current_date - 12, current_date + 18)
  returning id into inv2;

  insert into public.job_invoices (org_id, job_id, number, status, subtotal, total, amount_paid, issued_on, due_on)
  values (o, po_sol,'EA-0090','draft', 1044.00, 1044.00, 0, current_date + 2, current_date + 32);

  insert into public.job_invoice_lines (invoice_id, description, qty, unit, unit_price, total, position) values
    (inv1,'Original, wholesale case',      120,'case', 58.00,  6960.00, 0),
    (inv1,'Verde, wholesale case',          60,'case', 58.00,  3480.00, 1),
    (inv1,'Smoked salt, wholesale case',    20,'case', 72.00,  1440.00, 2),
    (inv1,'Reaper, wholesale case',         20,'case', 64.00,  1280.00, 3),
    (inv1,'Pallet freight, in state',        2,'pallet',185.00,  370.00, 4),
    (inv1,'Early payment discount',          1, null, -770.00,  -770.00, 5),
    (inv2,'Original, wholesale case',       48,'case', 58.00,  2784.00, 0),
    (inv2,'Verde, wholesale case',          24,'case', 58.00,  1392.00, 1);

  -- ── Pipeline: shelves she wants ────────────────────────────────────────
  insert into public.targets (org_id, name, status, note, next_step, website, contact_name, contact_email) values
    (o,'Kestrel Co-op','researching','Four stores, strong local-maker programme.','Find the category buyer','https://example.com',null,null),
    (o,'Highland Grocers','approached','Sent samples to the Dallas office.','Follow up in two weeks','https://example.com','Ada Lindqvist','ada@example.com'),
    (o,'Two Rivers Distribution','talking','Wants exclusivity in Oklahoma. Probably not worth it.','Decide on exclusivity','https://example.com','Sam Petrov','sam@example.com'),
    (o,'Grand Union Markets','passed','Slotting fee was more than a year of margin.',null,null,null,null);

  -- ── Pitches ────────────────────────────────────────────────────────────
  insert into public.pitches (org_id, customer_id, title, recipient, sections, published_at, views, last_viewed_at) values
    (o, d_solstice,'Ember & Ash for Solstice','Nadia Brandt',
     '[{"kind":"intro","body":"Six SKUs, made in Austin, no distributor markup between us."},
       {"kind":"scope","body":"Opening order of 18 cases, free freight on the first drop."},
       {"kind":"proof","body":"Pintail moves 220 cases a quarter across 140 independents."}]'::jsonb,
     now() - interval '14 days', 7, now() - interval '9 days'),
    (o, null,'The line, for buyers','Any category buyer',
     '[{"kind":"intro","body":"The standing deck. Line, pricing, lead times, shelf life."}]'::jsonb,
     now() - interval '40 days', 23, now() - interval '4 days');

  -- ── History ────────────────────────────────────────────────────────────
  insert into public.customer_notes (org_id, customer_id, job_id, kind, source, direction, happened_on, title, body) values
    (o,d_pintail, po_pintail,'meeting','typed','out', current_date - 74,'Q3 category review','Ruth took the full line again and asked about a Q4 gift set. Reaper sold out in nine weeks last run.'),
    (o,d_fairweather, po_fair,'email','typed','in', current_date - 15,'First order confirmed','Twelve stores to start, Original and Verde only. Will look at the salt after Thanksgiving.'),
    (o,d_solstice, null,'call','typed','out', current_date - 9,'Opening order agreed','Nadia said yes on the call and confirmed by email the same afternoon.'),
    (o,d_marisol, null,'email','typed','in', current_date - 3,'Asked about export docs','Hector needs the nutrition panel in Spanish and the FDA registration number.');

  raise notice 'ember and ash in';
end $$;
