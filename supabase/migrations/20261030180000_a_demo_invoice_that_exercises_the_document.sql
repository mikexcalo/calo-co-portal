/*
  A demo invoice shaped like the real ones, so the document can be checked.

  The new PDF has branches nothing in the demo reached: work split across two
  months, a line waived outright, a line comped down from an already-reduced
  price, a sentence under a line item, a modules list written as one sentence,
  a due date overridden with a note, and a rate that is below standard for a
  stated reason.

  Northwind Studio bills Harbor Light, which is the same arrangement CALO&CO
  has with its own clients, so the document can be compared like for like
  without touching a real invoice.

  Harbor Light's agreed rate was recorded as 140 against a standard of 140,
  which says there is no discount. It is 70 against 140 here, because a rate
  line with two identical numbers in it is the one case the document should
  not draw.

  Demo only: Northwind and Harbor Light are both `is_demo`, and every statement
  is keyed on their ids.
*/

update public.customer_terms
   set hourly_rate = 70, standard_rate = 140
 where org_id = '912fe1dc-5b79-4f6f-b954-761fc4111f1d'
   and customer_id = 'fefb9967-1a7a-4460-a814-6ebcb8527c1c';

update public.customers
   set discount_label = 'Founding client rate'
 where id = 'fefb9967-1a7a-4460-a814-6ebcb8527c1c';

/* The invoice itself. Draft, never sent, and it keeps a token so the document
   can be opened without sending anything. */
insert into public.job_invoices
  (org_id, job_id, number, status, issued_on, due_on, due_note,
   subtotal, tax_rate, tax_amount, total, amount_paid, public_token)
select '912fe1dc-5b79-4f6f-b954-761fc4111f1d',
       'bd6f5ebf-391b-41b4-a224-d65b24f32762',
       'HLR-002', 'draft', date '2026-10-01', date '2026-10-15',
       'Whenever, at your own pace',
       0, 0, 0, 0, 0,
       replace(gen_random_uuid()::text, '-', '')
       || substr(replace(gen_random_uuid()::text, '-', ''), 1, 4)
 where not exists (select 1 from public.job_invoices where number = 'HLR-002');

insert into public.job_invoice_lines
  (invoice_id, kind, description, note, billed_month, qty, unit,
   unit_price, list_unit_price, total, waived, comped_from, position)
select i.id, v.kind, v.description, v.note, v.billed_month, v.qty, v.unit,
       v.unit_price, v.list_unit_price, v.total, v.waived, v.comped_from, v.position
  from public.job_invoices i
  cross join (values
    ('labor', 'Domain setup and placeholder site', null::text, date '2026-09-01',
     0::numeric, null::text, 0::numeric, null::numeric, 0::numeric, true, null::numeric, 0),
    ('labor', 'Brand strategy and identity',
     'Positioning, the mark, and the logo suite', date '2026-09-01',
     2.5, 'hour', 70, 140, 175, false, null, 1),
    ('labor', 'Website design and launch', null, date '2026-09-01',
     4.0, 'hour', 70, 140, 280, false, null, 2),
    ('labor', 'Systems set up and ongoing support',
     'Modules: Pricing, Proposals, Receipts, Records, Reviews, Routes, Targets, Traffic, Brand kit, and SEO',
     date '2026-09-01', 1.5, 'hour', 70, 140, 105, false, null, 3),
    ('material', 'Website hosting, monthly', null, date '2026-09-01',
     1, 'month', 20, 20, 20, false, null, 4),
    ('material', 'Platform fee, monthly',
     'On me this month, since you have not gotten started in the platform yet.',
     date '2026-10-01', 1, 'month', 0, 40, 0, false, 20, 5)
  ) as v(kind, description, note, billed_month, qty, unit,
         unit_price, list_unit_price, total, waived, comped_from, position)
 where i.number = 'HLR-002'
   and not exists (select 1 from public.job_invoice_lines l where l.invoice_id = i.id);

update public.job_invoices i
   set subtotal = t.sum, total = t.sum
  from (select invoice_id, sum(total) as sum from public.job_invoice_lines group by invoice_id) t
 where t.invoice_id = i.id and i.number = 'HLR-002';
