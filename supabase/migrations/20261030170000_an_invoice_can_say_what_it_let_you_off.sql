/*
  What an invoice needs to say that it could not say before.

  The reference documents show an invoice doing four things the schema had no
  room for:

    - grouping lines under the month the work happened in, so a bill covering
      two months reads as two months rather than one list;
    - a line of explanation under a line item, in the sender's own words;
    - waiving a line outright - it appears, with no hours and no price, so the
      customer can see it was done and see it was free;
    - comping a line that already had a reduced price, showing the reduction
      struck through and nothing owed, with a reason.

  Plus two sentences the sender writes once:

    - `job_invoices.due_note` replaces the due date on the document. "Whenever,
      at your own pace" is a real thing to tell somebody, and it belongs next to
      the date it overrides rather than in an email they will lose.
    - `customers.discount_label` names why this customer's rate is not the
      standard one. The document already showed both numbers; it could not say
      what the gap was for.

  The hourly rate and the standard rate are deliberately NOT stored. They are
  read off the invoice's own hourly lines, so the rate line at the top can never
  disagree with the lines underneath it.

  Nothing here changes an existing row. Every column is nullable or defaults to
  the behaviour that was already in place.
*/

alter table public.job_invoices
  add column if not exists due_note text;

comment on column public.job_invoices.due_note is
  'Shown instead of the due date on the document, with the date struck through. Null means the date stands.';

alter table public.job_invoice_lines
  add column if not exists note text,
  add column if not exists billed_month date,
  add column if not exists waived boolean not null default false,
  add column if not exists comped_from numeric;

comment on column public.job_invoice_lines.note is
  'A sentence under the line item, in the sender''s words. Never repeats the month.';
comment on column public.job_invoice_lines.billed_month is
  'First of the month this line belongs under. Null falls back to the invoice period.';
comment on column public.job_invoice_lines.waived is
  'Done, and not charged for. Shows no hours and no price, and reads "Waived".';
comment on column public.job_invoice_lines.comped_from is
  'A price that was going to be charged and is not. Struck through beside $0.00.';

alter table public.customers
  add column if not exists discount_label text;

comment on column public.customers.discount_label is
  'Why this customer''s rate is below standard, in the studio''s words. Shown on the rate line.';
