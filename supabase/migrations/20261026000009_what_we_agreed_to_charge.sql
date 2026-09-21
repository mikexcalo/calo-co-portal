-- What was agreed with a client, written down before anybody bills it.
--
-- The deal with John and Mark exists entirely in Mike's head: sixty an hour
-- instead of the usual hundred and twenty because they are friends, twenty a
-- month for hosting, billed on the first, paid by Venmo or PayPal. None of
-- that is anywhere, and an arrangement that lives in one person's memory is
-- the one that gets misremembered in six months when somebody queries an
-- invoice.
--
-- The important thing this table is NOT: an instruction to bill. Nothing reads
-- it to generate an invoice, and nothing will until billing_live is turned on
-- deliberately. Recording a rate and charging it are different acts, and
-- conflating them is how a client gets an invoice nobody meant to send.

create table if not exists public.customer_terms (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.orgs(id) on delete cascade,
  customer_id   uuid not null unique references public.customers(id) on delete cascade,

  -- What they pay, and what it would have been. Both, because a discount you
  -- cannot see is a discount nobody thanks you for — and in a year nobody will
  -- remember this was a favour rather than the price.
  hourly_rate   numeric(10,2),
  standard_rate numeric(10,2),
  why_discounted text,

  -- The flat monthly. Named, because "20/month" on its own becomes an argument.
  monthly_fee   numeric(10,2),
  monthly_fee_for text,

  -- Charged for using the platform. Deliberately null: undecided, and a
  -- plausible placeholder would get billed one day by somebody who assumed it
  -- had been agreed.
  platform_fee  numeric(10,2),

  -- Day of the month. 1 is the first.
  bills_on      int not null default 1 check (bills_on between 1 and 28),
  pay_by        text,

  -- The switch. Off means this is a record of what was agreed and nothing more.
  billing_live  boolean not null default false,
  agreed_on     date,
  note          text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists customer_terms_updated_at on public.customer_terms;
create trigger customer_terms_updated_at before update on public.customer_terms
  for each row execute function public.set_updated_at();

alter table public.customer_terms enable row level security;

drop policy if exists customer_terms_own on public.customer_terms;
create policy customer_terms_own on public.customer_terms
  for all to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

comment on table public.customer_terms is
  'What was agreed with a client: their rate, what it would otherwise have been, any flat monthly, when it bills and how they pay. Recording it is not the same as charging it — nothing bills from this until billing_live is true.';

-- ---------------------------------------------------------------------------
-- The two friends-and-family deals, as agreed.
-- ---------------------------------------------------------------------------

insert into public.customer_terms
  (org_id, customer_id, hourly_rate, standard_rate, why_discounted,
   monthly_fee, monthly_fee_for, bills_on, pay_by, billing_live, agreed_on, note)
select c.org_id, c.id, 60.00, 120.00, 'Friends and family',
       20.00, 'Hosting', 1, 'Venmo or PayPal', false, current_date,
       'Platform use will be charged on top once the amount is decided. Nothing is being invoiced yet.'
  from public.customers c
  join public.orgs o on o.id = c.org_id
 where o.name = 'CALO&CO'
   and c.name in ('Global Seafood Partners', 'Mammoth Construction')
on conflict (customer_id) do nothing;
