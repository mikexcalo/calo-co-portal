-- Whose price list is this.
--
-- price_items began as one thing: what you charge. That holds for a builder,
-- and breaks for a distributor. John is going to drop a Sysco sheet into the
-- same screen, and those are not his prices — they are what somebody charges
-- him. Filed together, an estimate would quote a customer at cost.
--
-- Two columns rather than a second table, because it is the same shape of row
-- and the same screen. What changes is who the number belongs to.
--
--   ours      what you charge. The default, and the only list estimates pick from.
--   supplier  what somebody charges you. Reference, never quoted by accident.
--
-- The client's own catalogue stays where it is: client_products, hanging off
-- the client, because what a client sells is about them and not about you.

alter table public.price_items
  add column if not exists belongs_to text not null default 'ours'
    check (belongs_to in ('ours', 'supplier'));

alter table public.price_items
  add column if not exists supplier text;

comment on column public.price_items.belongs_to is
  'ours = what you charge, and the only list an estimate may pick from. supplier = what somebody charges you, kept for reference.';
comment on column public.price_items.supplier is
  'Who charges it, when belongs_to is supplier. Null for your own prices.';

create index if not exists price_items_belongs_to
  on public.price_items (org_id, belongs_to);


-- John has settled on the name.
update public.orgs
   set name = 'Global Seafood Partners'
 where name = 'Untitled business';

select name, slug from public.orgs where name = 'Global Seafood Partners';
