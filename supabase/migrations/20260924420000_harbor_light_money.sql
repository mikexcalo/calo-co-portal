-- Harbor Light Roofing, part two: everything with a number on it.
--
-- The figures are built to reconcile. Two months of logged hours at each
-- client's agreed rate, costs against the jobs that had them, invoices whose
-- totals equal their lines, and one overdue so the chase state is visible.
-- A reviewer who adds it up gets the same answer the screens do.
--
-- All @example.com. Nothing here can be delivered.

set local search_path = public, extensions;

do $$
declare
  o uuid;
  c_alvarez uuid; c_brandt uuid; c_costa uuid; c_dunmore uuid; c_ellery uuid;
  j_alvarez uuid; j_brandt uuid; j_costa uuid; j_dunmore uuid; j_ellery uuid; j_blockd uuid;
  inv_a uuid; inv_b uuid; inv_c uuid;
begin
  select id into o from public.orgs where slug = 'harbor-light-demo';
  if o is null or exists (select 1 from public.job_invoices where org_id = o) then
    raise notice 'nothing to do'; return;
  end if;

  select id into c_alvarez from public.customers where org_id=o and name='Alvarez Property Group';
  select id into c_brandt  from public.customers where org_id=o and name='Brandt & Sons Builders';
  select id into c_costa   from public.customers where org_id=o and name='Costa Residence';
  select id into c_dunmore from public.customers where org_id=o and name='Dunmore Storage';
  select id into c_ellery  from public.customers where org_id=o and name='Ellery House';

  select id into j_alvarez from public.jobs where org_id=o and name like 'Wickersham block C%';
  select id into j_brandt  from public.jobs where org_id=o and name like 'Airport Blvd%';
  select id into j_costa   from public.jobs where org_id=o and name like 'Ramsey Ave%';
  select id into j_dunmore from public.jobs where org_id=o and name like 'Burnet Rd%';
  select id into j_ellery  from public.jobs where org_id=o and name like 'Kinney Ave%';
  select id into j_blockd  from public.jobs where org_id=o and name like 'Wickersham block D%';

  -- ── Price list ─────────────────────────────────────────────────────────
  insert into public.price_items (org_id, name, description, category, unit, unit_price, kind, active, confirmed, confirmed_at, position) values
    (o,'Tear-off and dispose','Strip to deck, haul away, dumpster included.','Roofing','square',  145.00,'labor', true,true,now(),1),
    (o,'Architectural shingle, installed','30-year laminate, synthetic underlay.','Roofing','square', 385.00,'material',true,true,now(),2),
    (o,'TPO membrane, installed','60 mil, mechanically fastened.','Roofing','square', 610.00,'material',true,true,now(),3),
    (o,'Deck repair','Replace rotted sheathing where found.','Roofing','sheet',      78.00,'material',true,true,now(),4),
    (o,'Ridge vent','Continuous, cut and installed.','Roofing','linear ft',           14.50,'material',true,true,now(),5),
    (o,'Gutter, 6 inch seamless','Aluminium, hung and sealed.','Gutters','linear ft',  11.00,'material',true,true,now(),6),
    (o,'Crew hour','Two-man crew on site.','Time','hour',                             95.00,'labor',  true,true,now(),7),
    (o,'Emergency call-out','Same day, tarp and make safe.','Time','call',           275.00,'labor',  true,true,now(),8);

  -- ── Proposals: one of each state ───────────────────────────────────────
  insert into public.estimates (org_id, job_id, status, total, base_total, sent_at, sent_to, viewed_at, decided_at, decided_by_name, decided_via, valid_until, intro)
  values
    (o, j_dunmore,'sent',      24680.00, 24680.00, now() - interval '6 days','nate@example.com', now() - interval '4 days', null, null, null, current_date + 24,
     'Two units, same spec as the pair we did for you in March.'),
    (o, j_ellery,'draft',       4150.00,  4150.00, null, null, null, null, null, null, null,
     'Gutters and fascia on the street side only, as discussed.'),
    (o, j_blockd,'accepted',   21400.00, 21400.00, now() - interval '38 days','renata@example.com', now() - interval '37 days', now() - interval '36 days','Renata Alvarez','platform', current_date + 50,
     'Block D, same build as block C. Price held from last year.'),
    (o, j_costa,'accepted',     3890.00,  3890.00, now() - interval '74 days','m.costa@example.com', now() - interval '73 days', now() - interval '73 days','Marisol Costa','email', current_date - 40,
     'Storm damage on the north slope. Insurance job.');

  -- ── Two months of time ─────────────────────────────────────────────────
  insert into public.time_entries (org_id, job_id, hours, rate, worked_on, billable, worker_name, description)
  select o, j_alvarez, h, 85.00, d, true, 'Crew', 'Block C re-roof'
    from (values (8.0, current_date - 68),(8.0, current_date - 67),(7.5, current_date - 66),
                 (8.0, current_date - 65),(6.0, current_date - 64)) v(h,d);

  insert into public.time_entries (org_id, job_id, hours, rate, worked_on, billable, worker_name, description)
  select o, j_costa, h, 85.00, d, true, 'Crew', 'Storm repair, north slope'
    from (values (6.5, current_date - 61),(4.0, current_date - 60)) v(h,d);

  insert into public.time_entries (org_id, job_id, hours, rate, worked_on, billable, worker_name, description)
  select o, j_brandt, h, 88.00, d, true, 'Crew', 'TPO overlay, phase one'
    from (values (8.0, current_date - 21),(8.0, current_date - 20),(8.0, current_date - 19),
                 (7.0, current_date - 14),(8.0, current_date - 13),(5.5, current_date - 12),
                 (8.0, current_date - 7),(8.0, current_date - 6),(6.0, current_date - 5)) v(h,d);

  -- ── Costs and receipts ─────────────────────────────────────────────────
  insert into public.costs (org_id, job_id, amount, kind, vendor, description, purchased_on, billable, recurrence) values
    (o, j_alvarez, 4820.00,'material','Finn Roofing Supply','Shingle and underlay, block C', current_date - 69, true, 'once'),
    (o, j_alvarez,  610.00,'equipment','Austin Skip Hire','30 yard dumpster',                current_date - 68, true, 'once'),
    (o, j_costa,    980.00,'material','Finn Roofing Supply','Shingle, north slope',          current_date - 62, true, 'once'),
    (o, j_brandt,  9240.00,'material','Finn Roofing Supply','TPO membrane, 60 mil',          current_date - 23, true, 'once'),
    (o, j_brandt,   430.00,'permit','City of Austin','Commercial re-roof permit',            current_date - 25, true, 'once'),
    (o, j_brandt,  1150.00,'subcontractor','Delgado Sheet Metal','Coping and flashing',      current_date - 11, true, 'once');

  -- ── Overheads, the monthly running cost ────────────────────────────────
  insert into public.costs (org_id, job_id, amount, kind, vendor, description, purchased_on, billable, recurrence) values
    (o, null, 1850.00,'other','Sterling Insurance','General liability and workers comp', current_date - 30, false, 'monthly'),
    (o, null,  420.00,'other','Verizon','Two trucks, phones and data',                   current_date - 30, false, 'monthly'),
    (o, null,  310.00,'other','Fuelman','Fuel cards',                                    current_date - 30, false, 'monthly'),
    (o, null,   96.00,'other','Nautilus','Platform and hosting',                         current_date - 30, false, 'monthly');

  -- ── Invoices: paid, sent, overdue, draft ───────────────────────────────
  insert into public.job_invoices (org_id, job_id, number, status, subtotal, total, amount_paid, issued_on, due_on, paid_at)
  values (o, j_alvarez,'HLR-0041','paid', 21430.00, 21430.00, 21430.00, current_date - 58, current_date - 28, now() - interval '31 days')
  returning id into inv_a;

  insert into public.job_invoices (org_id, job_id, number, status, subtotal, total, amount_paid, issued_on, due_on)
  values (o, j_costa,'HLR-0042','overdue', 3890.00, 3890.00, 0, current_date - 52, current_date - 22)
  returning id into inv_b;

  insert into public.job_invoices (org_id, job_id, number, status, subtotal, total, amount_paid, issued_on, due_on)
  values (o, j_brandt,'HLR-0043','sent', 14260.00, 14260.00, 6000.00, current_date - 9, current_date + 21)
  returning id into inv_c;

  insert into public.job_invoices (org_id, job_id, number, status, subtotal, total, amount_paid, issued_on, due_on)
  values (o, j_blockd,'HLR-0044','draft', 8400.00, 8400.00, 0, current_date + 4, current_date + 34);

  insert into public.job_invoice_lines (invoice_id, description, qty, unit, unit_price, total, position) values
    (inv_a,'Tear-off and dispose, 42 square',        42, 'square', 145.00,  6090.00, 0),
    (inv_a,'Architectural shingle installed, 42 sq', 42, 'square', 385.00, 16170.00, 1),
    (inv_a,'Deck repair, 12 sheets',                 12, 'sheet',   78.00,   936.00, 2),
    (inv_a,'Credit, agreed on scheduling',            1, null,   -1766.00, -1766.00, 3),
    (inv_b,'Emergency call-out',                      1, 'call',  275.00,    275.00, 0),
    (inv_b,'Storm repair, north slope, 9 square',     9, 'square', 385.00,  3465.00, 1),
    (inv_b,'Deck repair, 2 sheets',                   2, 'sheet',   78.00,    156.00, 2),
    (inv_c,'TPO membrane installed, 18 square',      18, 'square', 610.00, 10980.00, 0),
    (inv_c,'Coping and flashing, subcontracted',      1, null,    1150.00,  1150.00, 1),
    (inv_c,'Crew hours, phase one',                  22, 'hour',    95.00,  2090.00, 2),
    (inv_c,'Permit',                                  1, null,     430.00,   430.00, 3);

  -- ── Pipeline ───────────────────────────────────────────────────────────
  insert into public.targets (org_id, name, status, note, next_step, website, contact_name, contact_email) values
    (o,'Meridian Self Storage','researching','Four buildings on Ben White, roofs look original.','Find out who manages it','https://example.com',null,null),
    (o,'Hollis Apartments','approached','Left a card with the office. Manager is Dee.','Call back Thursday','https://example.com','Dee Whitlock','dee@example.com'),
    (o,'Cedar Park Medical Plaza','talking','Walked it with facilities. Wants two options, TPO and modified bitumen.','Send both options','https://example.com','Aaron Vance','a.vance@example.com'),
    (o,'Novak Warehousing','passed','Went with the cheapest of four. Worth asking again in two years.',null,null,null,null);

  raise notice 'harbor light money in';
end $$;
