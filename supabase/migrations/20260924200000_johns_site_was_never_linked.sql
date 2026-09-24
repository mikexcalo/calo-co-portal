-- "We literally built the site for him this week, how do you not have it."
--
-- It is on file. globalseafood.partners has been in client_sites since the
-- 26th, put there by the migration that announced the launch. What it never
-- got was a customer_id, so the client record's Their website panel — which
-- looks up by customer_id — found nothing and offered to add a site that
-- already existed.
--
-- And it has no managed_by_org_id, which is the column client_sites_manage
-- checks. So CALO&CO could not write to the row it created, and adding the
-- URL by hand failed with "You do not have access to do that here".
--
-- Same for Mammoth: managed_by is right, customer_id is null.

update public.client_sites cs
   set customer_id = c.id
  from public.customers c
 where c.org_id = '3404f233-379d-4fa9-95b8-9b37a8dd8634'
   and cs.customer_id is null
   and cs.name = c.name;

-- The agency built and looks after John's site, the same as Mammoth's.
update public.client_sites
   set managed_by_org_id = '3404f233-379d-4fa9-95b8-9b37a8dd8634'
 where managed_by_org_id is null
   and name = 'Global Seafood Partners';

-- The client record should carry the address too; it is what the site panel
-- pre-fills from and what "Open their site" uses.
update public.customers
   set website = 'https://globalseafood.partners'
 where name = 'Global Seafood Partners'
   and org_id = '3404f233-379d-4fa9-95b8-9b37a8dd8634'
   and website is null;
