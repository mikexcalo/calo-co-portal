/*
  Backlog #24. Costa's demo invoice is rebuilt from the work it is for.

  `Ramsey Ave storm repair` is a time-and-materials job, and CLAUDE.md is
  explicit that invoices are built from actuals. CR-001 was not. Its three
  lines were typed fixed-price entries - a call-out, nine square of roof and
  two sheets of deck - with `source_time_entry_id` and `source_cost_id` both
  null, adding to a number somebody chose first.

  Meanwhile the job's real work sat on no invoice at all: 10.5 hours at $85
  across two entries, and one $980 material from Finn Roofing Supply, all
  three billable with `invoiced_on` null. So a completed T&M job showed
  $1,872.50 of unbilled actuals sitting beside an invoice already marked
  overdue, and taught the opposite of the rule.

  The three lines below are exactly what `rebuildDraftFromActuals` in
  `lib/spine/db.ts` would produce from those rows: the entry's own description,
  hours as quantity, the rate as unit price, and the cost at face value because
  the job sets no material markup. Written as a fixture rather than run through
  the function so the demo is reproducible from the migrations alone.

  The accepted proposal stays at $3,896. On a T&M job that is the forecast, not
  a cap, and a job that came in under it is the more useful demo.

  Demo workspaces only - the WHERE clause is pinned to the one invoice id, and
  every table touched belongs to Harbor Light Roofing, which is `is_demo`.
*/

do $$
declare
  v_invoice uuid := '16295e7f-453f-4211-a401-4432feec5f8b';
  v_job     uuid := '7d53607c-4831-40bf-9fe6-3cd5d9cd15a7';
  v_time_a  uuid := '1fc0aa6d-f3cd-4f0f-86a0-f888de090e0b';
  v_time_b  uuid := '8df6710f-948b-4b56-b936-aaf180ab16c2';
  v_cost    uuid := '165fd2f4-6bb8-4c5b-86f7-e6d3ba036d80';
  v_subtotal numeric;
begin
  /* Refuse rather than guess if the fixture has moved on. */
  if not exists (select 1 from job_invoices where id = v_invoice and number = 'CR-001') then
    raise notice 'CR-001 not found at the expected id. Nothing changed.';
    return;
  end if;

  delete from job_invoice_lines where invoice_id = v_invoice;

  insert into job_invoice_lines
    (invoice_id, kind, description, qty, unit, unit_price, total, position,
     source_time_entry_id, source_cost_id)
  select v_invoice, 'labor', t.description, t.hours, 'hr', t.rate,
         round(t.hours * t.rate, 2),
         row_number() over (order by t.worked_on) - 1,
         t.id, null
    from time_entries t
   where t.id in (v_time_a, v_time_b);

  insert into job_invoice_lines
    (invoice_id, kind, description, qty, unit, unit_price, total, position,
     source_time_entry_id, source_cost_id)
  select v_invoice, 'material', c.description, 1, null, c.amount, c.amount, 2,
         null, c.id
    from costs c
   where c.id = v_cost;

  /*
    Billed is billed. Without this the Home count still calls them unbilled.

    `invoiced_on` is a uuid holding the invoice, not a date, whatever the name
    says. `rebuildDraftFromActuals` sets it to `draft.id`.
  */
  update time_entries set invoiced_on = v_invoice where id in (v_time_a, v_time_b);
  update costs        set invoiced_on = v_invoice where id = v_cost;

  select sum(total) into v_subtotal from job_invoice_lines where invoice_id = v_invoice;

  update job_invoices
     set subtotal     = v_subtotal,
         tax_amount   = round(v_subtotal * (tax_rate / 100), 2),
         total        = round(v_subtotal + round(v_subtotal * (tax_rate / 100), 2), 2),
         /* The span the work actually happened in, as the rebuild sets it. */
         period_start = (select min(d) from (
                           select worked_on d from time_entries where id in (v_time_a, v_time_b)
                           union all select purchased_on from costs where id = v_cost) x),
         period_end   = (select max(d) from (
                           select worked_on d from time_entries where id in (v_time_a, v_time_b)
                           union all select purchased_on from costs where id = v_cost) x)
   where id = v_invoice;
end $$;
