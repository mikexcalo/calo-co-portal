-- ============================================================================
-- MORE THAN ONE PERSON, AND KNOWING WHO OWES YOU A REPLY
-- ============================================================================
-- Two gaps that only show up once you actually run an agency out of this.
--
-- A client is a company, not a person. Mark is the CEO, but there is an office
-- manager who sends the invoices and a foreman who answers the phone when Mark
-- is on a roof. The record held exactly one name, so the other two lived in a
-- phone's contacts app and nowhere else.
--
-- And: you text somebody Thursday, no answer. You text again Monday, still
-- nothing. That is the most common state in agency work and the record had no
-- way to express it. A note saying "texted Mark" reads identically whether he
-- replied an hour later or has been silent for a fortnight.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- The people at a client.
--
-- Separate from customers.contact_name, which stays as the primary. This is
-- everyone else: the bookkeeper, the site lead, the person who actually
-- approves things.
-- ---------------------------------------------------------------------------

create table if not exists public.customer_contacts (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  name        text not null,
  title       text,
  email       text,
  phone       text,
  note        text,
  -- Who to contact by default. Enforced as at most one per customer below.
  is_primary  boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists customer_contacts_customer_idx
  on public.customer_contacts(customer_id);

-- Two primaries is not a state anybody meant to create, and it makes "who do
-- I email" ambiguous at exactly the wrong moment.
create unique index if not exists customer_contacts_one_primary
  on public.customer_contacts(customer_id) where is_primary;

alter table public.customer_contacts enable row level security;

drop policy if exists customer_contacts_own on public.customer_contacts;
create policy customer_contacts_own on public.customer_contacts
  for all to authenticated
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

comment on table public.customer_contacts is
  'Everyone else at a client company. A client is an organization; one name was never going to be enough.';

-- ---------------------------------------------------------------------------
-- Chasing.
--
-- Direction matters: a note about a message you sent and a note about a
-- message you received look the same in a list, and only one of them means
-- somebody owes you an answer.
--
-- awaiting_reply_since sits on the customer rather than on the note, because
-- the question being asked is about the relationship — "has this person gone
-- quiet on me" — not about any individual message.
-- ---------------------------------------------------------------------------

alter table public.customer_notes add column if not exists direction text
  check (direction in ('out', 'in'));

comment on column public.customer_notes.direction is
  'out = you contacted them, in = they contacted you. Only an unanswered "out" means somebody owes you a reply.';

alter table public.customers add column if not exists awaiting_reply_since date;

comment on column public.customers.awaiting_reply_since is
  'When you last reached out and got nothing back. Cleared the moment anything inbound is logged.';

-- ---------------------------------------------------------------------------
-- Keep it truthful automatically.
--
-- Asking somebody to remember to clear a flag is asking them to maintain a
-- second record of something they already recorded. Logging an inbound message
-- IS the reply, so it clears the flag itself.
-- ---------------------------------------------------------------------------

create or replace function public.sync_awaiting_reply()
returns trigger
language plpgsql
as $function$
begin
  if new.customer_id is null then
    return new;
  end if;

  if new.direction = 'in' then
    update customers set awaiting_reply_since = null where id = new.customer_id;
  end if;

  -- Only the first unanswered message starts the clock. Chasing three times
  -- should read as "silent since Thursday", not "silent since this morning".
  if new.direction = 'out' then
    update customers
       set awaiting_reply_since = coalesce(
             awaiting_reply_since,
             coalesce(new.happened_on, current_date)
           ),
           last_contacted_on = coalesce(new.happened_on, current_date)
     where id = new.customer_id;
  end if;

  return new;
end;
$function$;

drop trigger if exists customer_notes_awaiting on customer_notes;
create trigger customer_notes_awaiting
  after insert on customer_notes
  for each row execute function public.sync_awaiting_reply();
