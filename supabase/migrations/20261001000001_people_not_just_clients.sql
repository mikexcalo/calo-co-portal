-- ============================================================================
-- THE ADDRESS BOOK IS BIGGER THAN THE CLIENT LIST
-- ============================================================================
-- A fractional ops leader you had one good call with is not a client, not a
-- prospect company, and not a person at a client. She is the third thing this
-- has never had room for: somebody worth remembering, with a website, a role,
-- and the substance of what you actually discussed.
--
-- Those people currently go in a phone, a notebook, or nowhere, and the cost
-- shows up six months later when you need somebody who does exactly what she
-- does and cannot remember her name.
--
-- WHY THIS IS NOT A NEW TABLE
--
-- customer_contacts already holds people. Adding a `contacts` table beside it
-- would mean two places to look for a person, two search boxes, and the
-- guarantee that somebody is filed in the wrong one. So the existing table
-- widens: customer_id becomes optional, and a person who belongs to nobody is
-- simply a person.
--
-- This is the same rule the sidebar was cut down by. Merge, do not multiply.
-- ============================================================================

-- A person no longer has to belong to a client.
alter table public.customer_contacts
  alter column customer_id drop not null;

comment on column public.customer_contacts.customer_id is
  'The client they work for, when they work for one. Null for everybody else: people met, referrers, freelancers, anyone worth remembering.';

/**
 * Where they work, when it is not a client of yours.
 *
 * Free text rather than a reference to another table. She works somewhere you
 * have no relationship with, and inventing a company record to hold a string
 * is how an address book turns into data entry.
 */
alter table public.customer_contacts
  add column if not exists company text;

alter table public.customer_contacts
  add column if not exists website text;

/**
 * What they are to you.
 *
 * Not a pipeline stage. A pipeline stage says how close somebody is to paying;
 * this says why they are in the book at all, which does not change over time
 * the way a stage does.
 */
alter table public.customer_contacts
  add column if not exists relationship text not null default 'contact'
    check (relationship in (
      'contact',      -- met them, worth knowing
      'client',       -- works at a client
      'prospect',     -- might buy
      'referrer',     -- sends work your way
      'freelancer',   -- you might hire them
      'partner'       -- you might sell together
    ));

comment on column public.customer_contacts.relationship is
  'Why they are in the book. Not a pipeline stage: a stage says how close somebody is to paying, this says what they are to you, which does not move.';

/**
 * Where you met, and when.
 *
 * The single most useful thing about a contact six months later, and the first
 * thing that goes. "Trade show, March" is the difference between a warm note
 * and an email that reads as cold outreach to somebody you have already met.
 */
alter table public.customer_contacts
  add column if not exists met_how text;

alter table public.customer_contacts
  add column if not exists met_on date;

/** When you last actually spoke. Drives the nudge, same as clients. */
alter table public.customer_contacts
  add column if not exists last_spoke_on date;

-- Anybody attached to a client is a client contact, whatever the default said.
update public.customer_contacts
   set relationship = 'client'
 where customer_id is not null
   and relationship = 'contact';

/**
 * Exactly one main contact per client, still.
 *
 * The old index was unconditional on customer_id. Now that customer_id can be
 * null, unattached people would all collide on a single null group in some
 * versions and silently not be constrained in others. Scoping it to rows that
 * actually have a client keeps the guarantee where it means something.
 */
drop index if exists customer_contacts_one_primary;
create unique index if not exists customer_contacts_one_primary
  on public.customer_contacts(customer_id)
  where is_primary and customer_id is not null;

-- Somebody unattached is not the "main contact" of anything.
update public.customer_contacts
   set is_primary = false
 where customer_id is null and is_primary;

create index if not exists customer_contacts_book_idx
  on public.customer_contacts(org_id, relationship, name);

comment on table public.customer_contacts is
  'Every person, whether or not they work for a client. The address book, org-scoped like everything else.';
