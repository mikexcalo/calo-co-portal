-- Three places in the product query columns that do not exist. Every one
-- fails silently: PostgREST returns an error, the caller discards it, and the
-- screen renders as though there were simply nothing to show.
--
-- 1. price_items.belongs_to and price_items.supplier
--
--    ClientIntake writes both when importing a price sheet, and its own
--    comment says why: "The toggle above decided this and then nothing wrote
--    it down, so every sheet went in as your own prices — including a
--    warehouse sheet, which estimates would then quote from." Somebody fixed
--    the code and never added the columns, so the insert now fails outright
--    and importing a price list does nothing at all.
--
--    The estimate builder reads belongs_to too, filtering to (belongs_to ??
--    'ours') === 'ours'. That select errors, so building an estimate has
--    never been able to load your price list.
--
-- 2. site_requests.detail
--
--    The notifications bell selects id, title, detail, status. The column is
--    called body. So the bell has never shown a site request.
--
-- 3. customer_summary.linked_org_id
--
--    The workspace switcher reads it to find each linked client's logo. The
--    view does not expose it, so the query errors and every client in the
--    menu falls back to initials.

alter table public.price_items
  add column if not exists belongs_to text not null default 'ours'
    check (belongs_to in ('ours', 'supplier')),
  add column if not exists supplier text;

comment on column public.price_items.belongs_to is
  'ours = what you charge. supplier = somebody else''s sheet, kept for '
  'reference and deliberately not quotable from.';
