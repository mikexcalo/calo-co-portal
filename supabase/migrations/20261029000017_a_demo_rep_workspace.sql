/*
  A demo workspace for the third vocabulary.

  `vocabFor` has three sets of words and the demo only ever had two of them.
  A contractor has Jobs and Customers, a studio has Projects and Clients, and
  a rep has Projects and **Principals** and sells to **Buyers** - and the only
  workspace in the product with `kind = 'rep'` is Global Seafood Partners,
  which is John's real business. So the rep's words could be read in
  `org.tsx` and never seen on a screen without opening a real client's data,
  which is the one thing the rulebook says not to do to check a layout.

  Coastline Brokerage is a manufacturer's rep: it represents other people's
  lines and quotes off their sheets. That is why the words differ. The
  companies on its Principals screen pay it; the Buyers are who it sells to.

  Same three-tier shape as the other demo clients: the org, an owner
  membership for the demo account, and a `customers` row in Northwind Studio
  whose `linked_org_id` points at it, so `studio_for()` resolves and Get help,
  View mode and the change log all behave as they do for a real client.
*/

/* A token default on one of these tables calls gen_random_bytes, and pgcrypto
   lives in the extensions schema, which is not on the path inside a DO block.
   The same trap 20260924220000 hit and wrote down. */
set local search_path = public, extensions;

do $$
declare
  uid  uuid;
  nw   uuid := '912fe1dc-5b79-4f6f-b954-761fc4111f1d';  -- Northwind Studio
  rep  uuid := gen_random_uuid();
begin
  select id into uid from auth.users where email = 'mikexcalo+demo@gmail.com';
  if uid is null then
    raise notice 'no demo account; nothing to do';
    return;
  end if;

  if exists (select 1 from public.orgs where slug = 'coastline-rep-demo') then
    raise notice 'already there';
    return;
  end if;

  insert into public.orgs (id, name, slug, kind, is_demo, default_labor_rate, onboarded_at, modules, settings)
  values (
    rep, 'Coastline Brokerage', 'coastline-rep-demo', 'rep', true, 0, now(),
    /* A rep has no jobs to cost and no receipts to bill on, so the modules
       that exist to do that are off. Targets and Pitches are the work. */
    '{"seo":"off","market":"live","routes":"off","catalog":"live","pricing":"off",
      "records":"off","reviews":"off","stories":"live","targets":"live",
      "traffic":"off","receipts":"off","brand_kit":"live","pitches":"live"}'::jsonb,
    '{}'::jsonb
  );

  insert into public.memberships (user_id, org_id, role) values (uid, rep, 'owner');

  /* The link that makes Northwind its studio. */
  insert into public.customers (org_id, name, stage, linked_org_id, contact_name, email)
  values (nw, 'Coastline Brokerage', 'won', rep, 'Sam Okonjo', 'sam@example.com');

  /* Enough of its own data that the words have something to sit next to.
     Principals are the lines it represents; they pay the commission. */
  insert into public.customers (org_id, name, stage, contact_name, email) values
    (rep, 'Ardmore Tackle Works', 'won',      'Priya Raman',  'priya@example.com'),
    (rep, 'Mellon Cold Chain',    'won',      'Dev Mensah',   'dev@example.com'),
    (rep, 'Kestrel Marine Supply','talking',  'Wei Tanaka',   'wei@example.com');

  raise notice 'coastline %', rep;
end $$;
