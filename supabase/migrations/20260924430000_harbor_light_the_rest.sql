-- Harbor Light Roofing, part three: the modules that are not money.
--
-- Records, requests, pitches and a history on each client, so no sidebar row
-- opens onto an empty state during the audit. Still @example.com throughout,
-- still only this org.
--
-- Records point at storage paths that hold no file. The list, the categories
-- and the expiry warnings are all real; pressing Download on one will fail.
-- That is deliberate — uploading fake PDFs into the live bucket to make a
-- demo look complete is worse than a download that does not work.

set local search_path = public, extensions;

do $$
declare
  o uuid;
  c_alvarez uuid; c_brandt uuid; c_costa uuid; c_dunmore uuid; c_ellery uuid;
  j_alvarez uuid; j_brandt uuid; j_dunmore uuid;
  site uuid;
begin
  select id into o from public.orgs where slug = 'harbor-light-demo';
  if o is null or exists (select 1 from public.business_files where org_id = o) then
    raise notice 'nothing to do'; return;
  end if;

  select id into c_alvarez from public.customers where org_id=o and name='Alvarez Property Group';
  select id into c_brandt  from public.customers where org_id=o and name='Brandt & Sons Builders';
  select id into c_costa   from public.customers where org_id=o and name='Costa Residence';
  select id into c_dunmore from public.customers where org_id=o and name='Dunmore Storage';
  select id into c_ellery  from public.customers where org_id=o and name='Ellery House';
  select id into j_alvarez from public.jobs where org_id=o and name like 'Wickersham block C%';
  select id into j_brandt  from public.jobs where org_id=o and name like 'Airport Blvd%';
  select id into j_dunmore from public.jobs where org_id=o and name like 'Burnet Rd%';

  -- ── Records ────────────────────────────────────────────────────────────
  insert into public.business_files (org_id, name, description, category, file_name, storage_path, mime_type, size_bytes, expires_on, shared_with_client) values
    (o,'General liability certificate','Two million aggregate. The one every commercial client asks for before you set foot on site.','insurance','HLR liability 2026.pdf', o::text||'/demo/liability.pdf','application/pdf', 284000, current_date + 96, true),
    (o,'Workers compensation certificate','Covers the crew. Renews with the liability policy.','insurance','HLR workers comp 2026.pdf', o::text||'/demo/workers-comp.pdf','application/pdf', 191000, current_date + 96, true),
    (o,'Roofing contractor registration','State registration. Lapsing in three weeks, which is the one on this list that stops work.','license','TX roofing registration.pdf', o::text||'/demo/registration.pdf','application/pdf', 122000, current_date + 21, false),
    (o,'Shingle warranty, 30 year','Manufacturer warranty terms. What is and is not covered when a client asks in year four.','manual','Laminate warranty terms.pdf', o::text||'/demo/warranty.pdf','application/pdf', 610000, null, true),
    (o,'Alvarez master agreement','Signed rates and scheduling terms across all eleven blocks.','contract','Alvarez master agreement.pdf', o::text||'/demo/alvarez.pdf','application/pdf', 340000, null, false);

  -- ── A site, so the requests have something to belong to ────────────────
  insert into public.client_sites (org_id, managed_by_org_id, customer_id, name, url, analytics_on)
  values (o, o, c_alvarez,'Harbor Light Roofing','https://example.com', false)
  returning id into site;

  insert into public.site_requests (org_id, site_id, title, body, kind, status, urgency, requester_name, requester_email, submitted_at) values
    (o, site,'Add the storm damage page','Everyone calls after a storm and asks the same four questions. Put them on a page I can text people.','new_feature','submitted','urgent','Renata Alvarez','renata@example.com', now() - interval '2 days'),
    (o, site,'Phone number is the old one','Footer still has the 555-0199 line. It rings nowhere.','bug','approved','urgent','Theo Brandt','theo@example.com', now() - interval '9 days'),
    (o, site,'Swap the hero photo','The Wickersham job came out better than the one that is up there now.','image','shipped','whenever','Renata Alvarez','renata@example.com', now() - interval '26 days');

  -- ── A pitch ────────────────────────────────────────────────────────────
  insert into public.pitches (org_id, customer_id, title, recipient, sections, published_at, views, last_viewed_at) values
    (o, c_dunmore,'Dunmore Storage, units 4 and 5','Nate Dunmore',
     '[{"kind":"intro","body":"Same spec as the pair we did in March, same crew."},{"kind":"scope","body":"Tear-off, deck repair where found, TPO overlay, new coping."},{"kind":"proof","body":"Six blocks for Alvarez Property Group over four years, no callbacks."}]'::jsonb,
     now() - interval '5 days', 3, now() - interval '2 days'),
    (o, null,'Commercial re-roof, standard deck','Anyone',
     '[{"kind":"intro","body":"The one we send cold to property managers."}]'::jsonb,
     null, 0, null);

  -- ── History, so Activity is not empty on every client ──────────────────
  insert into public.customer_notes (org_id, customer_id, job_id, kind, source, direction, happened_on, title, body) values
    (o, c_alvarez, j_alvarez,'call','typed','out', current_date - 58,'Block C signed off','Renata walked it with Hugo. Happy. Asked to pencil block D for the spring.'),
    (o, c_alvarez, null,'email','typed','in', current_date - 36,'Block D approved','Came back same day. Price held from last year.'),
    (o, c_brandt, j_brandt,'note','typed','out', current_date - 12,'Coping delayed','Delgado is a week out on the sheet metal. Told Theo, no drama, phase two slides to the 6th.'),
    (o, c_costa, null,'call','typed','out', current_date - 22,'Chased HLR-0042','Insurance has it, Marisol says two more weeks. Worth a nudge on the 5th.'),
    (o, c_dunmore, j_dunmore,'meeting','typed','out', current_date - 6,'Walked units 4 and 5','Nate wants it done before the dry season ends. Sent the proposal that afternoon.'),
    (o, c_ellery, null,'text','typed','in', current_date - 3,'Asked about gutters','Wants the street side only for now, rest next year.');

  raise notice 'harbor light, the rest, in';
end $$;
