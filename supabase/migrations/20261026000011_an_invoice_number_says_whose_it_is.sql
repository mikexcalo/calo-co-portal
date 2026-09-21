-- INV-0001 and INV-0002 tell you nothing.
--
-- Two invoices in a list called "Platform and support", both $60, both draft,
-- numbered one and two. Nothing on the row says whose it is. That is survivable
-- with two clients and unusable with twenty — and it is worse downstream, where
-- a client opens an email about INV-0002 and has no idea it is theirs, or
-- whether they have seen it before.
--
-- A number should say who it belongs to and where it sits in their sequence.
-- GSP-001 is John's first. MMTH-001 is Mark's first. Every client counts from
-- one, so a number never implies how many other clients there are.
--
-- This applies the same way one level down: when Mark sends an estimate to a
-- homeowner, that homeowner is a customer with a code too.

alter table public.customers
  add column if not exists code text;

comment on column public.customers.code is
  'Short prefix on this client''s invoice and estimate numbers, e.g. GSP-001. Suggested from the name and meant to be overridden — it is the thing they will read out on the phone.';

create unique index if not exists customers_one_code_each
  on public.customers (org_id, upper(code)) where code is not null;

-- ---------------------------------------------------------------------------
-- A suggestion, not a rule.
--
-- Initials of the significant words: "Global Seafood Partners" is GSP. One
-- word keeps its consonants: "Mammoth" is MMTH. Both are guesses at what
-- somebody would say out loud, and both are editable, because the only test
-- that matters is whether the client recognises it.
-- ---------------------------------------------------------------------------

create or replace function public.suggest_code(raw text)
returns text language sql immutable as $$
  with words as (
    select w, ord from unnest(string_to_array(
      regexp_replace(coalesce(raw, ''), '[^a-zA-Z ]', '', 'g'), ' ')) with ordinality as t(w, ord)
    where length(w) > 0
      and lower(w) not in ('the','and','of','a','an','llc','inc','ltd','co','company','group','services','solutions','construction','partners')
  )
  select case
    when (select count(*) from words) = 0 then
      upper(substr(regexp_replace(coalesce(raw,'x'), '[^a-zA-Z]', '', 'g'), 1, 4))
    when (select count(*) from words) = 1 then
      upper(substr(regexp_replace((select w from words), '[aeiouAEIOU]', '', 'g'), 1, 4))
    else
      (select upper(string_agg(substr(w, 1, 1), '' order by ord)) from words)
  end
$$;

update public.customers
   set code = public.suggest_code(name)
 where code is null;

-- Both of these are what they were asked to be, not what the function guessed.
update public.customers c set code = 'GSP'
  from public.orgs o where o.id = c.org_id and o.name = 'CALO&CO' and c.name = 'Global Seafood Partners';
update public.customers c set code = 'MMTH'
  from public.orgs o where o.id = c.org_id and o.name = 'CALO&CO' and c.name = 'Mammoth Construction';

-- Anything the suggestion collided with keeps a number on the end rather than
-- losing its code entirely.
update public.customers c
   set code = c.code || c2.tie::text
  from (select id, row_number() over (partition by org_id, upper(code) order by created_at) as tie
          from public.customers where code is not null) c2
 where c.id = c2.id and c2.tie > 1;
