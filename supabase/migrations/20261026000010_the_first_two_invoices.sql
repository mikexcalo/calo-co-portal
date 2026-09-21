-- The first two real invoices, built the way the system is meant to build them.
--
-- Not typed in as a total. An engagement exists, an hour is logged against it
-- at the rate that was agreed, and the invoice is drawn from that hour with the
-- line pointing back at it. That is the whole design — invoices come from
-- actuals — and until now nothing had ever gone through it. time_entries and
-- job_invoices have both been empty since the day they were created.
--
-- Both stay at draft. Nothing is sent, nothing is due, and the payment method
-- is Venmo or PayPal because that is what was agreed, not because anything is
-- wired up to take money.

do $$
declare
  agency uuid;
  rec record;
  jid uuid;
  tid uuid;
  iid uuid;
  n int;
  hours_total numeric;
begin
  select id into agency from public.orgs where name = 'CALO&CO';

  for rec in
    select c.id, c.name, t.hourly_rate
      from public.customers c
      join public.customer_terms t on t.customer_id = c.id
     where c.org_id = agency
       and c.name in ('Global Seafood Partners', 'Mammoth Construction')
     order by c.name
  loop
    -- One engagement per client, holding everything ongoing. Time and
    -- materials, because the work is hours and the hours are what gets billed.
    insert into public.jobs (org_id, customer_id, name, status, billing_type, billing_period)
    values (agency, rec.id, 'Platform and support', 'active', 'tm', 'monthly')
    returning id into jid;

    insert into public.time_entries
      (org_id, job_id, worked_on, hours, rate, worker_name, description, billable)
    values (agency, jid, current_date, 1, rec.hourly_rate, 'Mike',
            'Setup and support', true)
    returning id into tid;

    hours_total := 1 * rec.hourly_rate;

    select coalesce(max(seq), 0) + 1 into n from public.job_invoices where org_id = agency;

    insert into public.job_invoices
      (org_id, job_id, number, status, seq, period_start, period_end,
       issued_on, subtotal, tax_rate, tax_amount, total, notes)
    values (
      agency, jid, 'INV-' || lpad(n::text, 4, '0'), 'draft', n,
      current_date, current_date, current_date,
      hours_total, 0, 0, hours_total,
      'Pay by Venmo or PayPal. Hosting at $20/month starts on the 1st and is billed separately.'
    )
    returning id into iid;

    -- The line points back at the hour it came from, so "why am I being
    -- charged this" has an answer that is not somebody's memory.
    insert into public.job_invoice_lines
      (invoice_id, kind, description, qty, unit, unit_price, total, position, source_time_entry_id)
    values (iid, 'labor', 'Setup and support', 1, 'hour',
            rec.hourly_rate, hours_total, 0, tid);

    -- invoiced_on holds the invoice, not a date: the point is which one claimed it.
    update public.time_entries set invoiced_on = iid where id = tid;

    -- John's domain and holding page. Zero on purpose: the work happened and
    -- is on the record, and it was not charged for. A line saying $0 is an
    -- account of a decision; leaving it off is an account of nothing.
    if rec.name = 'Global Seafood Partners' then
      insert into public.job_invoice_lines
        (invoice_id, kind, description, qty, unit, unit_price, total, position)
      values (iid, 'other',
              'Domain setup and placeholder site — waived',
              1, null, 0, 0, 1);
    end if;
  end loop;
end $$;
