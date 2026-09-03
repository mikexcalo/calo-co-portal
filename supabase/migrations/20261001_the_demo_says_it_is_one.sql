-- ============================================================================
-- THE DEMO SHOULD LOOK LIKE A DEMO
-- ============================================================================
-- "Northsea Studio" with plausible people in it was the wrong call. It reads
-- as a real studio, which is fine right up until a screenshot of it ends up
-- somewhere real, or a name from it gets pasted into an actual email.
--
-- So the org is called Demo, every company carries the word, and every surname
-- is Example.
--
-- Every address is already on a `.example` domain, which is not decoration:
-- .example is reserved by IANA and can never resolve or receive mail. A demo
-- contact cannot be emailed by accident even if the send is triggered on
-- purpose. That property is worth more than any label on a screen.
--
-- These people were never in the CRM: they live in another org, and every
-- query goes through current_org_id(). The isolation is the same one that
-- keeps Mammoth's customers out of CALO&CO.
-- ============================================================================

do $demo$
declare
  d uuid;
begin
  select id into d from public.orgs where slug = 'demo-northsea';
  if d is null then return; end if;

  update public.orgs set name = 'Demo' where id = d;

  -- Companies say so in the name, because the name is what gets read out loud.
  update public.customers
     set name = case
       when name like '%(Demo)' then name
       else name || ' (Demo)'
     end
   where org_id = d;

  -- Surnames become Example, matching the .example addresses.
  update public.customer_contacts c
     set name = split_part(c.name, ' ', 1) || ' Example'
   where c.org_id = d
     and c.name not like '% Example';

  -- The cached copy on the company row has to agree with the person.
  update public.customers cu
     set contact_name = (
       select ct.name from public.customer_contacts ct
        where ct.customer_id = cu.id and ct.is_primary
        limit 1
     )
   where cu.org_id = d;

  -- Prospect companies too.
  update public.targets
     set name = case
       when name like '%(Demo)' then name
       else name || ' (Demo)'
     end
   where org_id = d;

  -- Suppliers on the overhead lines, so Profit & Loss reads as fake as it is.
  update public.costs
     set vendor = case
       when vendor like '%(Demo)' then vendor
       else vendor || ' (Demo)'
     end
   where org_id = d and vendor is not null;

end
$demo$;
