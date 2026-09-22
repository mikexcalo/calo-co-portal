-- ============================================================================
-- WRITE IT THE WAY YOU'D SAY IT
-- ============================================================================
-- The proposal still read like a document explaining itself. Headings like
-- "Your rate" — which, on a page somebody else is reading, sounds like the
-- rate THEY charge — and four paragraphs where two sentences would do.
--
-- This is the first thing either of them has been sent. It has to say what it
-- costs, why it is cheap, and when they get billed, in the order somebody
-- would actually ask.
--
-- PRICES
--   Work      $120/hr list, charged $60   — friends and family
--   Platform   $40/mo list, charged $20   — beta
--   Hosting    $20/mo
--   So $40 a month, plus $60 an hour when there is work.
--
-- The platform fee is read as being ON TOP of hosting rather than replacing
-- it, because hosting is already its own line on the invoices that exist. If
-- that is wrong, the monthly is $20 rather than $40 and only these two rows
-- change.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- What a line would have cost.
--
-- A discount you cannot see is a discount nobody values. The invoice already
-- derives the hourly one from the agreed terms, but that only works for hours
-- — there is nowhere to say a $20 monthly fee is $40 to everybody else. So a
-- line can carry its list price, and anything charged below it prints struck.
-- ---------------------------------------------------------------------------

alter table estimate_lines
  add column if not exists list_unit_price numeric(12,2);

alter table job_invoice_lines
  add column if not exists list_unit_price numeric(12,2);

comment on column estimate_lines.list_unit_price is
  'What this costs somebody who is not on a discount. Null means the price is the price.';

-- The platform fee is a number now, and the beta price is what is charged.
update customer_terms set platform_fee = 20.00 where platform_fee is null;

do $$
declare co uuid; r record;
begin
  select id into co from orgs where name = 'CALO&CO';
  if co is null then return; end if;

  for r in
    select e.id as est_id, c.contact_name, c.name as client
    from estimates e
    join jobs j      on j.id = e.job_id
    join customers c on c.id = j.customer_id
    where e.org_id = co and e.status = 'draft'
  loop
    delete from estimate_lines where estimate_id = r.est_id;

    insert into estimate_lines
      (estimate_id, kind, description, qty, unit, unit_price, list_unit_price, total, position, optional, selected)
    values
      (r.est_id, 'other', 'The platform — your workspace, kept running',
       1, 'month', 20.00, 40.00, 20.00, 1, false, true),
      (r.est_id, 'other', 'Web hosting',
       1, 'month', 20.00, null, 20.00, 2, false, true),
      (r.est_id, 'labor', 'Work on your account, when you ask for it',
       0, 'hour', 60.00, 120.00, 0.00, 3, false, true);

    update estimates set
      total = 40.00,
      base_total = 40.00,
      valid_until = current_date + 30,
      scope_in = jsonb_build_array(
        'Your workspace — people, records, jobs, all of it, kept running.',
        'Hosting for your site.',
        'Work whenever you ask for it, at $60 an hour.',
        'Fixing anything that''s wrong with what you already have.'
      ),
      scope_out = jsonb_build_array(
        'Work you haven''t asked for. Nothing happens on a schedule.',
        'Things we buy for you — a domain, ad spend, a paid tool. You pay what it cost. We don''t mark it up.',
        'Anything big enough to need its own quote. We''ll price that separately and you can say no.'
      ),
      notes =
        'What this costs' || chr(10) || chr(10) ||
        '$40 a month, plus $60 an hour when you need something done.' || chr(10) || chr(10) ||
        'The $40 covers the platform and your hosting. The hourly only gets charged' || chr(10) ||
        'when you actually ask for work, so plenty of months that''s nothing.' || chr(10) || chr(10) ||
        'Why the prices are crossed out' || chr(10) || chr(10) ||
        'You''re one of the first two businesses on this. The platform''s $40 and' || chr(10) ||
        'you''re paying $20. The hourly''s $120 and you''re paying $60.' || chr(10) || chr(10) ||
        'They''re not introductory rates that jump in six months. That''s what you pay' || chr(10) ||
        'for being early and telling me what''s broken.' || chr(10) || chr(10) ||
        'When you get billed' || chr(10) || chr(10) ||
        'The 1st, for the month before, by Venmo or PayPal. You get 14 days to pay.' || chr(10) || chr(10) ||
        'Every invoice is built from the hours logged and the receipts filed, so you' || chr(10) ||
        'can see what you''re paying for. Nothing gets typed in by hand.'
    where id = r.est_id;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- An invoice that never says when.
--
-- due_on has been on the table the whole time and nothing ever set it, so
-- every invoice went out with a dash where the date belongs. Asking somebody
-- to pay without saying by when is the cheapest possible way to get paid late.
--
-- Fourteen days from issue, which is what the proposals now promise.
-- ---------------------------------------------------------------------------

create or replace function public.invoice_due_date()
returns trigger
language plpgsql
as $$
begin
  if new.due_on is null then
    new.due_on := coalesce(new.issued_on, current_date) + 14;
  end if;
  return new;
end;
$$;

drop trigger if exists invoice_due_date on job_invoices;
create trigger invoice_due_date
  before insert or update on job_invoices
  for each row execute function public.invoice_due_date();

update job_invoices
set due_on = coalesce(issued_on, created_at::date) + 14
where due_on is null;
