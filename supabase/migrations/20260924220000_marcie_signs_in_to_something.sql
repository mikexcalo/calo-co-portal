-- Marcie's workspace is completely empty.
--
--   customers 0 · jobs 0 · invoices 0 · notes 0
--
-- She is looking on her husband's behalf. She would sign in to a blank
-- platform, a sidebar of empty screens and a list of setup tasks telling her
-- to set an hourly rate for a business that is not hers. There is nothing
-- there to form an opinion about, which is the one thing a person taking a
-- look needs.
--
-- Six sample rows: three customers, two jobs, one paid invoice and a note, in
-- the shape a home-services business actually has — one job finished and paid,
-- one live, one enquiry that has not been quoted. Enough to click through
-- every screen and see it doing something.
--
-- Every row is tagged 'sample' so it can be cleared in one statement the day
-- this stops being a look and starts being a business. Made-up names and
-- made-up money, on a workspace whose whole purpose is to be looked at.

/* A token default on one of these tables calls gen_random_bytes, and pgcrypto
   lives in the extensions schema, which is not on the path inside a DO block. */
set local search_path = public, extensions;

do $$
declare
  o   uuid;
  c1  uuid; c2  uuid; c3 uuid;
  j1  uuid; j2  uuid;
begin
  select id into o from public.orgs where slug = 'lakemere';
  if o is null then return; end if;

  /* Only ever once. */
  if exists (select 1 from public.customers where org_id = o) then return; end if;

  insert into public.customers (org_id, name, contact_name, email, phone, tags, stage, last_contacted_on)
  values (o, 'Rowan Delgado', 'Rowan Delgado', 'rowan.delgado@example.com', '(512) 555-0148', array['sample'], 'won',  current_date - 4)
  returning id into c1;

  insert into public.customers (org_id, name, contact_name, email, phone, tags, stage, last_contacted_on)
  values (o, 'Priya Raghunathan', 'Priya Raghunathan', 'priya.r@example.com', '(512) 555-0193', array['sample'], 'won', current_date - 11)
  returning id into c2;

  insert into public.customers (org_id, name, contact_name, email, phone, tags, stage)
  values (o, 'Bexar Street Apartments', 'Site manager', 'office@example.com', '(512) 555-0117', array['sample'], 'talking')
  returning id into c3;

  insert into public.jobs (org_id, customer_id, name, status, billing_type)
  values (o, c1, 'Back fence replacement', 'complete', 'tm')
  returning id into j1;

  insert into public.jobs (org_id, customer_id, name, status, billing_type)
  values (o, c2, 'Deck rebuild and stain', 'active', 'tm')
  returning id into j2;

  insert into public.jobs (org_id, customer_id, name, status, billing_type)
  values (o, c3, 'Replace gate hardware, 12 units', 'lead', 'tm');

  insert into public.job_invoices (org_id, job_id, number, status, subtotal, total, amount_paid, issued_on, due_on, paid_at)
  values (o, j1, 'LS-001', 'paid', 1840.00, 1840.00, 1840.00, current_date - 9, current_date + 21, now() - interval '3 days');

  insert into public.customer_notes (org_id, customer_id, job_id, kind, source, direction, happened_on, title, body)
  values (o, c2, j2, 'note', 'typed', 'in', current_date - 2,
          'Boards arriving Thursday',
          'Priya asked whether the stain can wait until the week after. Told her yes, it needs three dry days either way.');
end $$;
