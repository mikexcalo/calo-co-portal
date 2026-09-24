-- Tideline: a founder-run startup, two years old, six people.
--
-- Nothing here is a job or a route or a receipt. What a founder at this stage
-- actually runs on is who they are talking to, what they say about
-- themselves, and whether anybody can find them — so the seed is pipeline,
-- brand, messaging, pitches and digital, with a handful of real customers
-- paying real money.
--
-- All @example.com.

set local search_path = public, extensions;

do $$
declare
  o uuid; studio uuid; brand uuid;
  c_kestrel uuid; c_northgate uuid; c_lumen uuid;
  j_kestrel uuid; j_northgate uuid; j_lumen uuid;
  inv1 uuid; inv2 uuid;
  site uuid;
begin
  select id into o from public.orgs where slug = 'tideline-demo';
  select id into studio from public.orgs where slug = 'northwind-studio-demo';
  if o is null or exists (select 1 from public.customers where org_id = o) then
    raise notice 'nothing to do'; return;
  end if;

  -- ── Customers ──────────────────────────────────────────────────────────
  insert into public.customers (org_id, name, contact_name, contact_title, email, phone, stage, relationship, tags, brief)
  values (o,'Kestrel Logistics','Amara Diallo','VP Operations','amara@example.com','(415) 555-0301','won','customer',array['paying','logistics'],
    jsonb_build_object(
      'opportunity','Mid-size freight broker, 60 dispatchers, still reconciling load paperwork by hand.',
      'offer','Annual seat licence plus onboarding.',
      'buyers','Amara owns the budget. Her ops lead Priya is the one who has to like it.',
      'economics','$2,400 a month, annual up front, renews in March.',
      'constraints','Will not move data outside the US. Security review took nine weeks.'))
  returning id into c_kestrel;

  insert into public.customers (org_id, name, contact_name, contact_title, email, phone, stage, relationship, tags)
  values (o,'Northgate Freight','Tomas Reinholt','Head of Ops','tomas@example.com','(415) 555-0318','won','customer',array['paying'])
  returning id into c_northgate;

  insert into public.customers (org_id, name, contact_name, contact_title, email, phone, stage, relationship, tags)
  values (o,'Lumen Cold Chain','Jae-won Park','COO','jaewon@example.com','(415) 555-0327','proposed','customer',array['pilot'])
  returning id into c_lumen;

  insert into public.customer_contacts (org_id, customer_id, name, title, email, phone, is_primary) values
    (o,c_kestrel,'Amara Diallo','VP Operations','amara@example.com','(415) 555-0301', true),
    (o,c_kestrel,'Priya Raman','Ops lead','priya@example.com','(415) 555-0302', false),
    (o,c_northgate,'Tomas Reinholt','Head of Ops','tomas@example.com','(415) 555-0318', true),
    (o,c_lumen,'Jae-won Park','COO','jaewon@example.com','(415) 555-0327', true);

  -- ── Engagements ────────────────────────────────────────────────────────
  -- A retainer must carry its amount; the table enforces it, correctly.
  insert into public.jobs (org_id, customer_id, name, status, billing_type, retainer_amount)
  values (o,c_kestrel,'Annual licence and onboarding','active','retainer', 2400.00) returning id into j_kestrel;
  insert into public.jobs (org_id, customer_id, name, status, billing_type, retainer_amount)
  values (o,c_northgate,'Annual licence','active','retainer', 1200.00) returning id into j_northgate;
  insert into public.jobs (org_id, customer_id, name, status, billing_type)
  values (o,c_lumen,'Eight week pilot','estimating','fixed') returning id into j_lumen;

  -- ── Proposals ──────────────────────────────────────────────────────────
  insert into public.estimates (org_id, job_id, status, total, base_total, sent_at, sent_to, viewed_at, decided_at, decided_by_name, decided_via, intro) values
    (o, j_kestrel,'accepted', 28800.00, 28800.00, now() - interval '200 days','amara@example.com', now() - interval '199 days', now() - interval '186 days','Amara Diallo','paper',
     'Annual licence, sixty seats, onboarding included. Signed copy on file.'),
    (o, j_northgate,'accepted', 14400.00, 14400.00, now() - interval '96 days','tomas@example.com', now() - interval '95 days', now() - interval '92 days','Tomas Reinholt','platform',
     'Annual licence, thirty seats.');

  insert into public.estimates (org_id, job_id, status, total, base_total, sent_at, sent_to, viewed_at, intro)
  values (o, j_lumen,'sent', 9600.00, 9600.00, now() - interval '5 days','jaewon@example.com', now() - interval '2 days',
    'Eight week paid pilot across two depots, credited against an annual if it converts.');

  -- ── Invoices ───────────────────────────────────────────────────────────
  insert into public.job_invoices (org_id, job_id, number, status, subtotal, total, amount_paid, issued_on, due_on, paid_at)
  values (o, j_kestrel,'TL-0012','paid', 28800.00, 28800.00, 28800.00, current_date - 184, current_date - 154, now() - interval '170 days')
  returning id into inv1;

  insert into public.job_invoices (org_id, job_id, number, status, subtotal, total, amount_paid, issued_on, due_on)
  values (o, j_northgate,'TL-0019','sent', 14400.00, 14400.00, 7200.00, current_date - 20, current_date + 10)
  returning id into inv2;

  insert into public.job_invoice_lines (invoice_id, description, qty, unit, unit_price, total, position) values
    (inv1,'Annual licence, 60 seats',  60,'seat', 400.00, 24000.00, 0),
    (inv1,'Onboarding and migration',   1, null, 4800.00,  4800.00, 1),
    (inv2,'Annual licence, 30 seats',  30,'seat', 480.00, 14400.00, 0);

  -- ── Pipeline ───────────────────────────────────────────────────────────
  insert into public.targets (org_id, name, status, note, next_step, website, contact_name, contact_email) values
    (o,'Meridian Haulage','researching','Eleven depots. Their ops director spoke at the freight summit about exactly this problem.','Find a warm intro','https://example.com',null,null),
    (o,'Calder Transport','approached','Cold email, opened four times, no reply.','One more follow up then park it','https://example.com','Ines Calder','ines@example.com'),
    (o,'Blackmoor Logistics','talking','Second call done. Wants a security review before anything else.','Send the SOC2 readiness note','https://example.com','Dev Anand','dev@example.com'),
    (o,'Orbit Freight','talking','Pilot discussed, budget confirmed for next quarter.','Scope the pilot','https://example.com','Hanna Vogt','hanna@example.com'),
    (o,'Sable Group','passed','Built something internal last year. Revisit when it creaks.',null,null,null,null);

  -- ── Brand and what they say ────────────────────────────────────────────
  insert into public.brands (org_id, customer_id, name, status, kit)
  values (o, null,'Tideline','building', jsonb_build_object(
    'colors', jsonb_build_array(
      jsonb_build_object('name','Deep','hex','#0B1F2A','role','Primary ground'),
      jsonb_build_object('name','Tide','hex','#1B6B7A','role','Primary'),
      jsonb_build_object('name','Foam','hex','#8FD3D9','role','Accent'),
      jsonb_build_object('name','Sand','hex','#F2EFE7','role','Surface'),
      jsonb_build_object('name','Signal','hex','#E2703A','role','Highlight')),
    'fonts', jsonb_build_array(
      jsonb_build_object('role','Display and headlines','family','Fraunces','source','Google Fonts','weight','400'),
      jsonb_build_object('role','Body and UI','family','Inter','source','Google Fonts','weight','400 / 600')),
    'assets', jsonb_build_array()))
  returning id into brand;

  insert into public.brand_message (org_id, brand_id, promise, positioning, audience, mission, tone, elevator, pillars)
  values (o, brand,
    'The paperwork keeps itself.',
    'Tideline is load documentation for freight brokers: the rate confirmation, the BOL and the POD collected, matched and filed as the load moves, instead of chased by a dispatcher afterwards.',
    'Operations leaders at freight brokers and 3PLs with twenty to two hundred dispatchers — big enough that chasing paperwork is somebody''s whole job, small enough that nobody has built it in-house.',
    'To take the worst hour of a dispatcher''s day and give it back to them.',
    'Plain and unhurried, the way a good dispatcher talks on the radio. No logistics jargon invented after 2015, and never enthusiastic about software.',
    'A broker moves a load and generates four documents nobody wants to handle. Today a dispatcher chases them by phone and email for two days after delivery, and invoicing waits on the slowest one. Tideline collects each document at the moment it exists, matches it to the load, and files it — so the pack is complete when the truck is empty and billing goes out the same day.',
    '[{"name":"It collects, nobody chases","headline":"The pack is complete when the truck is empty.","support":["Documents are captured at the moment they exist, not retrieved afterwards.","Drivers send a photo to the number they already text.","No new app for anyone outside the office."]},
      {"name":"It matches without being told","headline":"Every document finds its own load.","support":["Reads the load number off the page rather than asking for it.","Flags the one that does not match instead of filing it wrong.","Two years of freight paperwork behind the matching."]},
      {"name":"Billing stops waiting","headline":"Invoice the day you deliver.","support":["Average days-to-invoice at Kestrel went from nine to one.","The pack goes out attached, so fewer disputes come back.","Nothing sits in somebody''s inbox over a weekend."]}]'::jsonb);

  -- ── Pitches ────────────────────────────────────────────────────────────
  insert into public.pitches (org_id, customer_id, title, recipient, sections, published_at, views, last_viewed_at) values
    (o, c_lumen,'Tideline for Lumen Cold Chain','Jae-won Park',
     '[{"kind":"intro","body":"Eight week pilot, two depots, credited against an annual."},
       {"kind":"scope","body":"Rate confirmations, BOLs and PODs across both depots. No IT work on your side."},
       {"kind":"proof","body":"Kestrel went from nine days to one on average days-to-invoice."}]'::jsonb,
     now() - interval '5 days', 11, now() - interval '1 day'),
    (o, null,'Tideline, the standing deck','Any ops leader',
     '[{"kind":"intro","body":"What it is, who it is for, and what it costs."}]'::jsonb,
     now() - interval '60 days', 84, now() - interval '2 days');

  -- ── Digital ────────────────────────────────────────────────────────────
  insert into public.client_sites (org_id, managed_by_org_id, customer_id, name, url, analytics_on)
  values (o, studio, null,'Tideline','https://example.com', true)
  returning id into site;

  insert into public.customer_notes (org_id, customer_id, job_id, kind, source, direction, happened_on, title, body) values
    (o,c_kestrel, j_kestrel,'meeting','typed','out', current_date - 14,'Quarterly review','Priya wants exception reporting on the matching. Amara asked about the renewal early, which is a good sign.'),
    (o,c_northgate, j_northgate,'email','typed','in', current_date - 20,'Half paid','Tomas split the annual across two quarters. Second half due the 10th.'),
    (o,c_lumen, j_lumen,'call','typed','out', current_date - 5,'Pilot scoped','Two depots, eight weeks. Jae-won has budget but needs the security questionnaire back first.');

  raise notice 'tideline in';
end $$;
