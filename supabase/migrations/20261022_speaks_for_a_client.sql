-- Not everyone attached to a client works there.
--
-- Marcie has a login to Lakemere's workspace and is the founder's wife. The
-- book could only say 'client', which now reads "works at a client" and is
-- plainly false. The near misses matter here: emailing her as staff, counting
-- her as a contact at the company, or chasing her about an invoice are all
-- things the wrong label invites.
--
-- The category is wider than her. A client's bookkeeper, a brother-in-law who
-- "does the computers", a consultant on retainer — none are employees and all
-- of them speak for the business. That is the useful thing to record, because
-- it is the thing that changes what you do: listen to them like the client,
-- do not write to them like staff.

alter table public.customer_contacts
  drop constraint if exists customer_contacts_relationship_check;

alter table public.customer_contacts
  add constraint customer_contacts_relationship_check
    check (relationship in (
      'contact',      -- met them, worth knowing
      'client',       -- works at a client
      'proxy',        -- speaks for a client without being employed by them
      'prospect',     -- might buy
      'referrer',     -- sends work your way
      'freelancer',   -- might work for you
      'partner'       -- you might sell together
    ));

comment on column public.customer_contacts.relationship is
  'Why they are in the book. Not a pipeline stage: a stage says how close somebody is to paying, this says what they are to you, which does not move. proxy is the one that is easy to get wrong — they act for a client but are not on its payroll.';
