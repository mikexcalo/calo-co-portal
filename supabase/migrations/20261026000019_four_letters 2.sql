-- ============================================================================
-- FOUR LETTERS, EVERY TIME
-- ============================================================================
-- The codes were whatever each one happened to get: AE, CI, GSP, LKMR, MMTH.
-- Two letters, three letters, four. So invoice numbers did not line up in a
-- column, could not be sorted by eye, and GSP-001 sat next to MMTH-001 looking
-- like two different systems.
--
-- Four letters for everybody. The default is the first four letters of the
-- name with the filler words dropped, which reads well and is predictable:
-- Colette Intelligence becomes COLE, Austin Energy becomes AUST.
--
-- It is a DEFAULT, not a law. Mike asked for GSEA on Global Seafood Partners,
-- which no rule produces — the same way MMTH and LKMR are consonant squeezes
-- that a first-four rule would have written as MAMM and LAKE. The column is
-- the authority; this only fills it where it is empty or the wrong length.
-- ============================================================================

create or replace function public.four_letter_code(nm text)
returns text
language sql
immutable
as $$
  select upper(
    rpad(
      left(
        regexp_replace(
          -- Filler nobody would say out loud, and the demo marker.
          regexp_replace(coalesce(nm,''), '(?i)\m(the|and|of|co|inc|llc|ltd|demo)\M', '', 'g'),
          '[^a-zA-Z]', '', 'g'
        ),
        4
      ),
      4, 'X'
    )
  )
$$;

comment on function public.four_letter_code is
  'A predictable four-letter default for a customer code. Overridden by hand where a better one exists.';

-- ---------------------------------------------------------------------------
-- Fill the ones that are not four letters, leaving good ones alone.
-- ---------------------------------------------------------------------------

update customers
set code = public.four_letter_code(name)
where code is null or length(code) <> 4;

-- The one Mike named.
update customers set code = 'GSEA' where name = 'Global Seafood Partners';

-- ---------------------------------------------------------------------------
-- A code has to be unique inside a business, or two clients' invoices collide.
-- ---------------------------------------------------------------------------

do $$
declare r record; n int;
begin
  for r in
    select id, org_id, code, name,
           row_number() over (partition by org_id, code order by created_at) as dup
      from customers
     where code is not null
  loop
    if r.dup > 1 then
      n := r.dup;
      update customers set code = left(r.code, 3) || n::text where id = r.id;
      raise notice 'Code clash on %, became %', r.name, left(r.code,3) || n::text;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Invoices already issued carry the old code in their number.
--
-- Rewritten to match, because a number is how a client refers to an invoice
-- when they pay it and how the payment gets matched back. Two invoices for the
-- same client under two different prefixes is the thing this change exists to
-- prevent, so leaving the old ones alone would create exactly that.
--
-- Only drafts are touched. An invoice that has been sent has its number in
-- somebody else's inbox, and changing it there would be worse than an
-- inconsistent prefix.
-- ---------------------------------------------------------------------------

update job_invoices i
set number = c.code || '-' || split_part(i.number, '-', 2)
from jobs j, customers c
where j.id = i.job_id
  and c.id = j.customer_id
  and i.status = 'draft'
  and c.code is not null
  and i.number is not null
  and split_part(i.number, '-', 1) <> c.code;

-- ---------------------------------------------------------------------------
-- The ampersand, properly this time.
--
-- It was cleared out of brand.logos and kept turning up, because the kit holds
-- three logo slots and only one of them was emptied: logoLight and logoDark
-- both still pointed at icon-1024.png, the site favicon, and every document
-- reads logoLight first. Clearing one of three and calling it done is why Mike
-- has now reported the same ampersand three times.
-- ---------------------------------------------------------------------------

update orgs
set settings = jsonb_set(
      jsonb_set(
        jsonb_set(settings, '{brand,logos}', '[]'::jsonb),
        '{brand,logoLight}', '""'::jsonb
      ),
      '{brand,logoDark}', '""'::jsonb
    )
where name = 'CALO&CO';
