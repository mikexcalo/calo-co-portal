-- John has a business address and a personal one, and the record held one.
--
-- Asked for on 23 September: put the business email on, keep the personal,
-- because both get used. Nothing was done, because there was nowhere to put
-- the second one — customer_contacts.email is a single column, so adding the
-- business address meant overwriting the personal address.
--
-- This is not a John problem. Every founder who has run a business out of a
-- gmail has two addresses, one of them is the one they actually read, and
-- which is which is not something you can guess from the domain.
--
-- email is the one to use. email_alt is the other one they also read.

alter table public.customer_contacts
  add column if not exists email_alt text;

comment on column public.customer_contacts.email_alt is
  'A second address this person also reads. Invoices and proposals go to '
  'email; this is for when you know they check the other one too.';

-- John Litton: business first, personal kept.
update public.customer_contacts cc
   set email     = 'globalseafood.partners@gmail.com',
       email_alt = 'john.littonny@gmail.com'
  from public.customers c
 where c.id = cc.customer_id
   and c.name = 'Global Seafood Partners'
   and cc.email = 'john.littonny@gmail.com';

update public.customers
   set email = 'globalseafood.partners@gmail.com'
 where name = 'Global Seafood Partners'
   and email = 'john.littonny@gmail.com';
