-- ============================================================================
-- WHAT THE DEMO SHOWS
-- ============================================================================
-- A studio mid-year with four clients, which is the shape somebody recognizes:
-- one on retainer that pays on time, one project that just landed, one that
-- has gone quiet, and one prospect still being chased.
--
-- Everything here is invented. Northsea Studio, its clients and its people do
-- not exist, and the numbers are chosen to be plausible rather than flattering.
-- A demo where every invoice is paid and nothing is late is a demo nobody
-- believes, and it hides the half of the product that is actually worth
-- paying for: the part that tells you what has gone wrong.
--
-- Dates are relative to now(), so this does not rot into a screen full of
-- things overdue by two years the first time it is left alone for a month.
--
-- Money is inserted as lines and left to the triggers. Seeding a total
-- directly would be a lie in the demo about how the real thing behaves.
-- ============================================================================

do $seed$
declare
  demo uuid;
  c_harbor uuid; c_fold uuid; c_marrow uuid; c_tilde uuid;
  j_harbor uuid; j_fold uuid; j_marrow uuid;
  inv uuid;
begin
  select id into demo from public.orgs where slug = 'demo-northsea';
  if demo is null then return; end if;

  -- Idempotent: re-running the migration must not double the studio.
  if exists (select 1 from public.customers where org_id = demo) then return; end if;

  -- --------------------------------------------------------------------
  -- The clients.
  -- --------------------------------------------------------------------

  insert into public.customers (org_id, name, stage, website, contact_name, contact_title, email, phone, brief)
  values (demo, 'Harbor & Vine', 'active', 'https://harborandvine.example',
          'Dana Okonjo', 'Managing Partner', 'dana@harborandvine.example', '(207) 555-0142',
          jsonb_build_object(
            'who', 'A twelve-seat wine bar in Portland that grew into three rooms and a wholesale list.',
            'doing', 'Monthly retainer: positioning, the site, and whatever the month needs.',
            'where', 'Second month. The framework is locked and the site rebuild is in review.',
            'stuck', 'Waiting on their photographer. Every visual decision is downstream of it.'))
  returning id into c_harbor;

  insert into public.customers (org_id, name, stage, website, contact_name, contact_title, email, brief)
  values (demo, 'Foldwork', 'active', 'https://foldwork.example',
          'Ren Ashworth', 'Founder', 'ren@foldwork.example',
          jsonb_build_object(
            'who', 'Two industrial designers who make small-run furniture for offices.',
            'doing', 'One project: naming and the launch of the new seating line.',
            'where', 'Just started. Discovery is booked for next week.',
            'stuck', 'Nothing yet.'))
  returning id into c_fold;

  insert into public.customers (org_id, name, stage, contact_name, contact_title, email, brief)
  values (demo, 'Marrow Bakery', 'active',
          'Sam Petrelli', 'Owner', 'sam@marrowbakery.example',
          jsonb_build_object(
            'who', 'Three bakeries and a wholesale arm that is now bigger than the shops.',
            'doing', 'Rebrand, finished in March. Nothing active since.',
            'where', 'Delivered and paid, apart from the final invoice.',
            'stuck', 'Final invoice is past due and two chases have gone unanswered.'))
  returning id into c_marrow;

  insert into public.customers (org_id, name, stage, contact_name, contact_title, email, brief)
  values (demo, 'Tilde Health', 'prospect',
          'Priya Raghunathan', 'Head of Brand', 'priya@tildehealth.example',
          jsonb_build_object(
            'who', 'Series A telehealth company, forty people, no brand function.',
            'doing', 'Nothing yet. Proposal sent for a positioning sprint.',
            'where', 'Sent eleven days ago. Opened twice, no reply.',
            'stuck', 'Needs a nudge. They said budget clears at quarter end.'))
  returning id into c_tilde;

  -- A company is more than one person, and the demo should say so.
  insert into public.customer_contacts (org_id, customer_id, name, title, email, is_primary)
  values
    (demo, c_harbor, 'Dana Okonjo', 'Managing Partner', 'dana@harborandvine.example', true),
    (demo, c_harbor, 'Luis Ferreira', 'Operations, handles invoices', 'accounts@harborandvine.example', false),
    (demo, c_fold, 'Ren Ashworth', 'Founder', 'ren@foldwork.example', true),
    (demo, c_fold, 'Mika Tan', 'Design lead', 'mika@foldwork.example', false),
    (demo, c_marrow, 'Sam Petrelli', 'Owner', 'sam@marrowbakery.example', true),
    (demo, c_tilde, 'Priya Raghunathan', 'Head of Brand', 'priya@tildehealth.example', true);

  -- --------------------------------------------------------------------
  -- The work.
  -- --------------------------------------------------------------------

  insert into public.jobs (org_id, customer_id, name, status, billing_type, billing_period,
                           retainer_amount, started_on, scheduled_start, scheduled_end, consideration)
  values (demo, c_harbor, 'Retainer: brand and site', 'active', 'retainer', 'monthly',
          4500, (now() - interval '58 days')::date,
          (now() - interval '58 days')::date, (now() + interval '120 days')::date, 'cash')
  returning id into j_harbor;

  insert into public.jobs (org_id, customer_id, name, status, billing_type, started_on, scheduled_start, scheduled_end, consideration)
  values (demo, c_fold, 'Naming and launch: seating line', 'active', 'fixed',
          (now() - interval '6 days')::date, (now() - interval '6 days')::date,
          (now() + interval '68 days')::date, 'cash')
  returning id into j_fold;

  insert into public.jobs (org_id, customer_id, name, status, billing_type, started_on, completed_on, consideration)
  values (demo, c_marrow, 'Rebrand', 'complete', 'fixed',
          (now() - interval '160 days')::date, (now() - interval '84 days')::date, 'cash')
  returning id into j_marrow;

  -- Steps, including one that has slipped. A schedule where everything is on
  -- time demonstrates nothing.
  insert into public.job_tasks (org_id, job_id, name, starts_on, ends_on, status, owner, position)
  values
    (demo, j_harbor, 'Site rebuild: templates', (now() - interval '9 days')::date, (now() + interval '4 days')::date, 'in_progress', 'us', 1),
    (demo, j_harbor, 'Photography direction', (now() - interval '14 days')::date, (now() - interval '3 days')::date, 'not_started', 'client', 2),
    (demo, j_harbor, 'Launch', (now() + interval '12 days')::date, (now() + interval '14 days')::date, 'not_started', 'us', 3),
    (demo, j_fold, 'Discovery session', (now() + interval '3 days')::date, (now() + interval '3 days')::date, 'not_started', 'us', 1),
    (demo, j_fold, 'Name candidates', (now() + interval '10 days')::date, (now() + interval '24 days')::date, 'not_started', 'us', 2),
    (demo, j_fold, 'Trademark screen', (now() + interval '25 days')::date, (now() + interval '32 days')::date, 'not_started', 'unassigned', 3);

  -- --------------------------------------------------------------------
  -- The money. Lines only; the triggers do the arithmetic.
  -- --------------------------------------------------------------------

  -- Paid, last month.
  insert into public.job_invoices (org_id, job_id, status, issued_on, due_on, paid_at, paid_via, tax_rate)
  values (demo, j_harbor, 'paid', (now() - interval '38 days')::date, (now() - interval '24 days')::date,
          now() - interval '27 days', 'bank transfer', 0)
  returning id into inv;
  insert into public.job_invoice_lines (invoice_id, kind, description, qty, unit, unit_price, position)
  values (inv, 'labor', 'Monthly retainer', 1, 'month', 4500, 1);

  -- Sent, not yet due. The normal state of a healthy month.
  insert into public.job_invoices (org_id, job_id, status, issued_on, due_on, sent_at, tax_rate)
  values (demo, j_harbor, 'sent', (now() - interval '8 days')::date, (now() + interval '6 days')::date,
          now() - interval '8 days', 0)
  returning id into inv;
  insert into public.job_invoice_lines (invoice_id, kind, description, qty, unit, unit_price, position)
  values
    (inv, 'labor', 'Monthly retainer', 1, 'month', 4500, 1),
    (inv, 'labor', 'Additional: trade show collateral', 6, 'hour', 150, 2);

  -- Overdue, and chased twice. This is the one that earns the product its fee.
  insert into public.job_invoices (org_id, job_id, status, issued_on, due_on, sent_at, nudged_at, tax_rate)
  values (demo, j_marrow, 'sent', (now() - interval '71 days')::date, (now() - interval '41 days')::date,
          now() - interval '71 days', now() - interval '12 days', 0)
  returning id into inv;
  insert into public.job_invoice_lines (invoice_id, kind, description, qty, unit, unit_price, position)
  values (inv, 'labor', 'Rebrand: final stage', 1, 'stage', 6800, 1);

  -- Paid, on the same finished job.
  insert into public.job_invoices (org_id, job_id, status, issued_on, due_on, paid_at, paid_via, tax_rate)
  values (demo, j_marrow, 'paid', (now() - interval '140 days')::date, (now() - interval '126 days')::date,
          now() - interval '131 days', 'card', 0)
  returning id into inv;
  insert into public.job_invoice_lines (invoice_id, kind, description, qty, unit, unit_price, position)
  values (inv, 'labor', 'Rebrand: deposit and first stage', 1, 'stage', 10200, 1);

  -- --------------------------------------------------------------------
  -- Overheads, so Profit & Loss has both sides of the story.
  -- --------------------------------------------------------------------

  insert into public.costs (org_id, kind, vendor, description, amount, purchased_on, billable, recurrence)
  select demo, d.knd, d.vend, d.descr, d.amt, (now() - (d.days || ' days')::interval)::date, false, d.rec
    from (values
      ('other',         'Pier Street Studios', 'Studio rent',            1400.00, 12, 'monthly'),
      ('other',         'Adobe',               'Adobe and Figma',         184.00, 20, 'monthly'),
      ('subcontractor', 'J. Alvarez',          'Contract illustrator',   1250.00, 26, 'once'),
      ('other',         'Pier Street Studios', 'Studio rent',            1400.00, 43, 'monthly'),
      ('other',         'Whitlock & Co',       'Accountant',              400.00, 51, 'quarterly')
    ) as d(knd, vend, descr, amt, days, rec);

  -- --------------------------------------------------------------------
  -- Something still to chase, so the pipeline is not empty.
  -- --------------------------------------------------------------------

  insert into public.targets (org_id, name, website, note, status, last_touch)
  select demo, t.nm, t.site, t.note, t.st, t.touch
    from (values
      ('Kettle & Co',       'https://kettleco.example',   'Coffee roaster, six sites. Met at the trade show.',      'researching', null::date),
      ('Northbound Cycles', 'https://northbound.example', 'Rebuilding their site in-house and it is going badly.', 'approached',  (now() - interval '9 days')::date),
      ('Pellet & Ash',      'https://pelletash.example',  'Referred by Harbor & Vine.',                            'talking',     (now() - interval '2 days')::date)
    ) as t(nm, site, note, st, touch);

end
$seed$;
