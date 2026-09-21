-- ============================================================================
-- LOGOS ON COMPANIES, FACES ON PEOPLE
-- ============================================================================
-- customers.avatar_url held headshots. Mammoth Construction was Mark's face
-- and Colette Intelligence was Frank's, so the client list read as a list of
-- men who happened to have company names attached. That is the same mistake as
-- the oversized portrait on the record, one level deeper: it was in the data,
-- not just the layout.
--
-- A client is a company, a brand or a concept. It has a logo. The humans are
-- in People, and they have faces. Two different columns on two different
-- tables, because they are two different kinds of thing.
-- ============================================================================

alter table public.customers
  add column if not exists logo_url text;

comment on column public.customers.logo_url is
  'The company mark. A client is a business, a brand or a concept: faces belong to the people in customer_contacts.';

do $move$
begin
  /**
   * Move each headshot to the person it is actually of.
   *
   * Only where that person has no picture yet, so this cannot overwrite
   * something already correct. Colette is exactly that case: Frank's contact
   * row already carried the same file, so there is nothing to move and the
   * company copy is simply dropped.
   */
  update public.customer_contacts ct
     set avatar_url = c.avatar_url
    from public.customers c
   where ct.customer_id = c.id
     and ct.is_primary
     and c.avatar_url is not null
     and ct.avatar_url is null;

  -- Nothing is inferred as a logo. Every existing value was a face, and
  -- guessing which of them might be a mark would put a headshot back on a
  -- company under a new column name.
  update public.customers
     set avatar_url = null
   where avatar_url is not null;
end
$move$;

comment on column public.customers.avatar_url is
  'Deprecated. Held headshots, which belonged to people. Read logo_url for the company mark; this stays only so nothing that still selects it breaks.';
