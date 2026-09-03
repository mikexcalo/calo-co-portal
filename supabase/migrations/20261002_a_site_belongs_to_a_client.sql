-- ============================================================================
-- A SITE BELONGS TO A CLIENT
-- ============================================================================
-- client_sites had an org and a URL and no client, which was fine while every
-- site was your own. It stops working the moment the question is "turn traffic
-- on for Mammoth": there was nothing to turn it on *for*.
--
-- Nullable, because your own site is a row here too and does not belong to a
-- client. That row is the one with a null customer_id, which is also how the
-- Traffic screen can tell "mine" from "theirs" without a second table.
-- ============================================================================

alter table public.client_sites
  add column if not exists customer_id uuid references customers(id) on delete set null;

comment on column public.client_sites.customer_id is
  'The client whose site this is. Null means it is your own, which is how a screen tells mine from theirs.';

create index if not exists client_sites_customer_idx
  on public.client_sites(customer_id);

-- ---------------------------------------------------------------------------
-- The demo stops being named after a studio.
--
-- Northsea was a plausible name, which was the problem. The slug went with it
-- so nothing anywhere still reads as a real business.
-- ---------------------------------------------------------------------------

update public.orgs
   set name = 'Demo', slug = 'demo'
 where slug = 'demo-northsea';

-- ---------------------------------------------------------------------------
-- Somebody met today, filed before the details exist.
--
-- The point of the address book is that a name and a website are enough to
-- start. Everything else can be filled in later, and usually is.
-- ---------------------------------------------------------------------------

insert into public.customer_contacts (org_id, name, website, relationship, met_how, met_on, last_spoke_on, is_primary)
select o.id,
       'Erika Till',
       'https://www.riselightco.com/',
       'contact',
       'Met today.',
       current_date,
       current_date,
       false
  from public.orgs o
 where o.slug = 'calo-co' or o.name = 'CALO&CO'
   and not exists (
     select 1 from public.customer_contacts c
      where c.org_id = o.id and c.name = 'Erika Till'
   )
 limit 1;
