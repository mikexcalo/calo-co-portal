-- Renumbering the two that exist, and putting hosting on them.
--
-- The sequence is per client, so both are 001. That is the point: a number
-- never has to imply how many other clients there are, and nobody can work out
-- your book from an invoice you sent them.

with numbered as (
  select i.id,
         c.code || '-' || lpad(
           (row_number() over (partition by c.id order by i.created_at, i.seq))::text, 3, '0') as n
    from public.job_invoices i
    join public.jobs j on j.id = i.job_id
    join public.customers c on c.id = j.customer_id
   where c.code is not null
)
update public.job_invoices i set number = numbered.n
  from numbered where numbered.id = i.id;

-- Hosting. Twenty a month, on every invoice, as its own line rather than
-- folded into a total — a client who cannot see what a charge is for is a
-- client who asks, and then you are both looking for an email.
insert into public.job_invoice_lines
  (invoice_id, kind, description, qty, unit, unit_price, total, position)
select i.id, 'other', 'Website hosting — monthly', 1, 'month', 20.00, 20.00,
       coalesce((select max(l.position) from public.job_invoice_lines l where l.invoice_id = i.id), -1) + 1
  from public.job_invoices i
  join public.jobs j on j.id = i.job_id
  join public.customers c on c.id = j.customer_id
 where c.code in ('GSP', 'MMTH')
   and i.status = 'draft'
   and not exists (
     select 1 from public.job_invoice_lines l
      where l.invoice_id = i.id and l.description like 'Website hosting%'
   );

-- Totals follow the lines, never the other way round.
update public.job_invoices i
   set subtotal = t.sum,
       tax_amount = round(t.sum * i.tax_rate / 100, 2),
       total = t.sum + round(t.sum * i.tax_rate / 100, 2)
  from (select invoice_id, sum(total) as sum from public.job_invoice_lines group by invoice_id) t
 where t.invoice_id = i.id and i.status = 'draft';
