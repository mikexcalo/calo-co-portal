-- "Hosting, on the 1st" does not say enough. Hosting of what.
--
-- It is the line a client reads on a terms card and on an invoice, and it is
-- the one recurring charge with no noun attached. Their website is the thing
-- being hosted, so the label says so.
update public.customer_terms
   set monthly_fee_for = 'Web hosting'
 where monthly_fee_for = 'Hosting';
