-- Three places where the seeded data and the module config disagreed.
-- Unreachable data in a demo is a trap: the auditor cannot see it, and
-- whoever looks at the database later cannot tell if it is a bug.
--
-- 1. Harbor Light had two pitches and Pitches switched off.
--    The config is the deliberate part — a roofer quoting off a price list
--    does not run a pitch deck — so the rows go rather than the decision.
--
-- 2. Ember & Ash and Tideline had Brand switched on and nothing in it.
--    The Brand module reads orgs.settings.brand, not the brands table, so
--    the screen was empty for both. Each gets a real palette and type.
--
-- 3. Northwind Studio had three clients and no work, so its own Home,
--    Invoices and Profit & Loss were blank — the one workspace an auditor
--    starts in.

set local search_path = public, extensions;

delete from public.pitches p
 using public.orgs o
 where o.id = p.org_id and o.slug = 'harbor-light-demo';

update public.orgs set settings = coalesce(settings,'{}'::jsonb) || jsonb_build_object(
  'brand', jsonb_build_object(
    'colors', jsonb_build_array(
      jsonb_build_object('name','Ember','hex','#B23A19','role','Primary'),
      jsonb_build_object('name','Ash','hex','#2E2A27','role','Deepest'),
      jsonb_build_object('name','Smoke','hex','#6E6A66','role','Body'),
      jsonb_build_object('name','Verde','hex','#4C7A3F','role','Accent'),
      jsonb_build_object('name','Cream','hex','#F4EFE6','role','Surface')),
    'fontHeading','Bricolage Grotesque',
    'fontBody','Inter',
    'voice','Warm, direct, a little bit hot. Never precious about food.'))
 where slug = 'ember-ash-demo';

update public.orgs set settings = coalesce(settings,'{}'::jsonb) || jsonb_build_object(
  'brand', jsonb_build_object(
    'colors', jsonb_build_array(
      jsonb_build_object('name','Deep','hex','#0B1F2A','role','Primary ground'),
      jsonb_build_object('name','Tide','hex','#1B6B7A','role','Primary'),
      jsonb_build_object('name','Foam','hex','#8FD3D9','role','Accent'),
      jsonb_build_object('name','Sand','hex','#F2EFE7','role','Surface'),
      jsonb_build_object('name','Signal','hex','#E2703A','role','Highlight')),
    'fontHeading','Fraunces',
    'fontBody','Inter',
    'voice','Plain and unhurried, the way a good dispatcher talks on the radio.'))
 where slug = 'tideline-demo';

-- The studio's own book of work.
do $$
declare
  s uuid; c record; j uuid; n int := 0;
begin
  select id into s from public.orgs where slug = 'northwind-studio-demo';
  if s is null or exists (select 1 from public.jobs where org_id = s) then return; end if;

  for c in select id, name from public.customers where org_id = s order by name loop
    n := n + 1;
    insert into public.jobs (org_id, customer_id, name, status, billing_type, retainer_amount)
    values (s, c.id, c.name || ' — platform and ongoing work', 'active', 'retainer', 1800.00)
    returning id into j;

    insert into public.time_entries (org_id, job_id, hours, rate, worked_on, billable, worker_name, description)
    select s, j, h, 140.00, d, true, 'Studio', 'Ongoing work'
      from (values (3.5, current_date - 26),(2.0, current_date - 19),
                   (4.0, current_date - 12),(1.5, current_date - 4)) v(h,d);

    insert into public.job_invoices (org_id, job_id, number, status, subtotal, total, amount_paid, issued_on, due_on, paid_at)
    values (s, j, 'NS-00' || (40 + n)::text,
            case when n = 3 then 'sent' else 'paid' end,
            1800.00, 1800.00,
            case when n = 3 then 0 else 1800.00 end,
            current_date - 24, current_date + 6,
            case when n = 3 then null else now() - interval '18 days' end);
  end loop;

  insert into public.costs (org_id, job_id, amount, kind, vendor, description, purchased_on, billable, recurrence) values
    (s, null, 240.00,'other','Adobe','Creative Cloud', current_date - 30, false,'monthly'),
    (s, null,  96.00,'other','Nautilus','Platform',      current_date - 30, false,'monthly'),
    (s, null, 180.00,'other','Sterling Insurance','Professional indemnity', current_date - 30, false,'monthly');
end $$;
