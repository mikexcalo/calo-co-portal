-- Harbor Light Roofing: a fictional business, seeded across every module.
--
-- For a UX audit, so the numbers have to hang together. A reviewer who adds
-- up the invoices and gets a different answer to Profit & Loss stops
-- reviewing the interface and starts reviewing the data.
--
-- EVERY address is @example.com. That is a reserved domain (RFC 2606) which
-- accepts no mail anywhere in the world, so nothing here can reach a person
-- even if something tries to send.
--
-- Nothing in this file touches CALO&CO, Mammoth, Global Seafood or Lakemere.
-- Every insert names the Harbor Light org id explicitly.

set local search_path = public, extensions;

do $$
declare
  o uuid;
  c_alvarez uuid; c_brandt uuid; c_costa uuid; c_dunmore uuid; c_ellery uuid; c_finn uuid;
  j_alvarez uuid; j_brandt uuid; j_costa uuid; j_dunmore uuid; j_ellery uuid; j_finn uuid;
  inv_a uuid; inv_b uuid; inv_c uuid; inv_d uuid;
begin
  select id into o from public.orgs where slug = 'harbor-light-demo';
  if o is null then raise notice 'no harbor light org'; return; end if;
  if exists (select 1 from public.customers where org_id = o) then
    raise notice 'already seeded'; return;
  end if;

  -- ── Clients ────────────────────────────────────────────────────────────
  insert into public.customers (org_id, name, contact_name, contact_title, email, phone, address, stage, relationship, tags, brief)
  values (o,'Alvarez Property Group','Renata Alvarez','Portfolio manager','renata@example.com','(512) 555-0102','2200 Wickersham Ln, Austin, TX','won','customer',array['repeat','commercial'],
          jsonb_build_object(
            'opportunity','Eleven small apartment blocks around Riverside, all built within four years of each other, so the roofs come due in a predictable run.',
            'offer','Full tear-off and re-roof, one or two blocks a year, scheduled in the dry season.',
            'buyers','Renata signs. Hugo on maintenance decides when a roof has stopped being patchable.',
            'edge','We have done six of the eleven, so there is no survey time and no surprises in the deck.',
            'economics','Roughly $18k to $26k a block depending on deck repair. Pays on terms, never chased.',
            'constraints','Tenants in place, so no work before 8am and the skips cannot block the lot.'
          ))
  returning id into c_alvarez;

  insert into public.customers (org_id, name, contact_name, contact_title, email, phone, address, stage, relationship, tags)
  values (o,'Brandt & Sons Builders','Theo Brandt','Site lead','theo@example.com','(512) 555-0147','810 Airport Blvd, Austin, TX','won','customer',array['trade','repeat'])
  returning id into c_brandt;

  insert into public.customers (org_id, name, contact_name, email, phone, address, stage, relationship)
  values (o,'Costa Residence','Marisol Costa','m.costa@example.com','(512) 555-0188','4417 Ramsey Ave, Austin, TX','won','customer')
  returning id into c_costa;

  insert into public.customers (org_id, name, contact_name, contact_title, email, phone, address, stage, relationship, tags)
  values (o,'Dunmore Storage','Nate Dunmore','Operations','nate@example.com','(512) 555-0121','9001 Burnet Rd, Austin, TX','proposed','customer',array['commercial'])
  returning id into c_dunmore;

  insert into public.customers (org_id, name, contact_name, email, phone, address, stage, relationship)
  values (o,'Ellery House','Priya Ellery','p.ellery@example.com','(512) 555-0166','1208 Kinney Ave, Austin, TX','talking','customer')
  returning id into c_ellery;

  insert into public.customers (org_id, name, contact_name, contact_title, email, phone, stage, relationship, tags)
  values (o,'Finn Roofing Supply','Dale Finn','Account rep','dale@example.com','(512) 555-0134','won','supplier',array['supplier'])
  returning id into c_finn;

  -- ── People ─────────────────────────────────────────────────────────────
  insert into public.customer_contacts (org_id, customer_id, name, title, email, phone, is_primary) values
    (o, c_alvarez,'Renata Alvarez','Portfolio manager','renata@example.com','(512) 555-0102', true),
    (o, c_alvarez,'Hugo Pena','Maintenance','hugo@example.com','(512) 555-0103', false),
    (o, c_brandt,'Theo Brandt','Site lead','theo@example.com','(512) 555-0147', true),
    (o, c_brandt,'Sam Brandt','Estimator','sam@example.com','(512) 555-0148', false),
    (o, c_costa,'Marisol Costa',null,'m.costa@example.com','(512) 555-0188', true),
    (o, c_dunmore,'Nate Dunmore','Operations','nate@example.com','(512) 555-0121', true),
    (o, c_ellery,'Priya Ellery',null,'p.ellery@example.com','(512) 555-0166', true),
    (o, c_finn,'Dale Finn','Account rep','dale@example.com','(512) 555-0134', true);

  -- ── Terms ──────────────────────────────────────────────────────────────
  insert into public.customer_terms (org_id, customer_id, hourly_rate, standard_rate, bills_on, pay_by, billing_live, agreed_on)
  values (o, c_alvarez, 85.00, 95.00, 1, 'Check or ACH', true, current_date - 240),
         (o, c_brandt,  88.00, 95.00, 1, 'ACH', true, current_date - 180);

  -- ── Jobs, at different stages ──────────────────────────────────────────
  insert into public.jobs (org_id, customer_id, name, status, billing_type, address)
  values (o,c_alvarez,'Wickersham block C re-roof','complete','tm','2200 Wickersham Ln')
  returning id into j_alvarez;

  insert into public.jobs (org_id, customer_id, name, status, billing_type, address)
  values (o,c_brandt,'Airport Blvd warehouse, TPO overlay','active','tm','810 Airport Blvd')
  returning id into j_brandt;

  insert into public.jobs (org_id, customer_id, name, status, billing_type, address)
  values (o,c_costa,'Ramsey Ave storm repair','complete','tm','4417 Ramsey Ave')
  returning id into j_costa;

  insert into public.jobs (org_id, customer_id, name, status, billing_type, address)
  values (o,c_dunmore,'Burnet Rd unit 4 and 5 re-roof','estimating','tm','9001 Burnet Rd')
  returning id into j_dunmore;

  insert into public.jobs (org_id, customer_id, name, status, billing_type, address)
  values (o,c_ellery,'Kinney Ave gutter and fascia','lead','tm','1208 Kinney Ave')
  returning id into j_ellery;

  insert into public.jobs (org_id, customer_id, name, status, billing_type)
  values (o,c_alvarez,'Wickersham block D re-roof','won','tm')
  returning id into j_finn;

  raise notice 'harbor light: clients and jobs in';
end $$;
