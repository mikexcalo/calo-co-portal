-- ============================================================================
-- MONEY IS COMPUTED, NOT SUBMITTED
-- ============================================================================
-- Found by writing a line item straight to the API: quantity 10, unit price
-- $250, and a total of whatever I felt like. The database accepted it, and
-- the estimate showed my number.
--
-- Line totals were being calculated in the browser and then stored as fact.
-- The estimate's total is the sum of those stored numbers, so a customer
-- could be sent a document reading "10 × $250" next to a total of $50, and
-- nothing anywhere would object. That is not a hypothetical: it is one
-- mis-typed multiplication or one stale form state away, and it fails in
-- front of the customer, in writing, in the document they are agreeing to.
--
-- Arithmetic that decides what somebody owes belongs in one place, and that
-- place has to be the one every path goes through.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A line's total is its quantity times its price. Always.
--
-- Whatever the caller sends for `total` is discarded rather than validated —
-- rejecting a mismatch would mean a working app breaks on a rounding
-- difference. Recomputing means the answer is simply right.
--
-- Negative unit prices stay legal on purpose: a credit line ("Less:
-- previously invoiced") is a negative price at quantity one, and progress
-- billing depends on it. Negative *quantities* are never meaningful and are
-- refused below.
-- ---------------------------------------------------------------------------

create or replace function public.compute_line_total()
returns trigger
language plpgsql
as $function$
begin
  new.total := round((coalesce(new.qty, 0) * coalesce(new.unit_price, 0))::numeric, 2);
  return new;
end;
$function$;

drop trigger if exists estimate_lines_compute_total on estimate_lines;
create trigger estimate_lines_compute_total
  before insert or update on estimate_lines
  for each row execute function public.compute_line_total();

drop trigger if exists job_invoice_lines_compute_total on job_invoice_lines;
create trigger job_invoice_lines_compute_total
  before insert or update on job_invoice_lines
  for each row execute function public.compute_line_total();

alter table estimate_lines drop constraint if exists estimate_lines_qty_sane;
alter table estimate_lines add constraint estimate_lines_qty_sane
  check (qty is null or qty >= 0);

alter table job_invoice_lines drop constraint if exists job_invoice_lines_qty_sane;
alter table job_invoice_lines add constraint job_invoice_lines_qty_sane
  check (qty is null or qty >= 0);

-- ---------------------------------------------------------------------------
-- An invoice's totals are its lines. Always.
--
-- estimates already had this; invoices did not, so an invoice's stored total
-- was only ever as correct as the code path that happened to create it. Every
-- path computes it the same way today — which is exactly the kind of thing
-- that stays true until the day somebody adds a fourth path.
--
-- Tax is recalculated from the invoice's own rate rather than preserved, so
-- editing a line cannot leave tax describing a subtotal that no longer
-- exists.
-- ---------------------------------------------------------------------------

create or replace function public.sync_invoice_totals()
returns trigger
language plpgsql
as $function$
declare
  target uuid := coalesce(new.invoice_id, old.invoice_id);
  sub numeric;
begin
  select coalesce(round(sum(total)::numeric, 2), 0)
    into sub
    from job_invoice_lines
   where invoice_id = target;

  update job_invoices
     set subtotal   = sub,
         tax_amount = round((sub * coalesce(tax_rate, 0) / 100)::numeric, 2),
         total      = round((sub + (sub * coalesce(tax_rate, 0) / 100))::numeric, 2)
   where id = target;

  return null;
end;
$function$;

drop trigger if exists job_invoice_lines_sync_totals on job_invoice_lines;
create trigger job_invoice_lines_sync_totals
  after insert or update or delete on job_invoice_lines
  for each row execute function public.sync_invoice_totals();

-- Changing the tax rate on an invoice has to move the money too.
create or replace function public.sync_invoice_on_tax_change()
returns trigger
language plpgsql
as $function$
begin
  if new.tax_rate is distinct from old.tax_rate then
    new.tax_amount := round((coalesce(new.subtotal, 0) * coalesce(new.tax_rate, 0) / 100)::numeric, 2);
    new.total      := round((coalesce(new.subtotal, 0) + new.tax_amount)::numeric, 2);
  end if;
  return new;
end;
$function$;

drop trigger if exists job_invoices_tax_change on job_invoices;
create trigger job_invoices_tax_change
  before update on job_invoices
  for each row execute function public.sync_invoice_on_tax_change();

-- ---------------------------------------------------------------------------
-- Repair anything already stored wrong, then let the triggers hold the line.
-- ---------------------------------------------------------------------------

update estimate_lines
   set total = round((coalesce(qty, 0) * coalesce(unit_price, 0))::numeric, 2)
 where total is distinct from round((coalesce(qty, 0) * coalesce(unit_price, 0))::numeric, 2);

update job_invoice_lines
   set total = round((coalesce(qty, 0) * coalesce(unit_price, 0))::numeric, 2)
 where total is distinct from round((coalesce(qty, 0) * coalesce(unit_price, 0))::numeric, 2);

update estimates e
   set total = coalesce((select round(sum(total)::numeric, 2) from estimate_lines where estimate_id = e.id), 0);

update job_invoices i
   set subtotal   = coalesce((select round(sum(total)::numeric, 2) from job_invoice_lines where invoice_id = i.id), 0),
       tax_amount = round((coalesce((select sum(total) from job_invoice_lines where invoice_id = i.id), 0) * coalesce(i.tax_rate, 0) / 100)::numeric, 2),
       total      = round((coalesce((select sum(total) from job_invoice_lines where invoice_id = i.id), 0) * (1 + coalesce(i.tax_rate, 0) / 100))::numeric, 2)
 where exists (select 1 from job_invoice_lines where invoice_id = i.id);
