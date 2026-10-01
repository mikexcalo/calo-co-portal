/*
  Demo invoices stop claiming a history they never had.

  Found while fixing one of them: CR-001 was `overdue`, had been viewed by the
  customer, and had `sent_at` null. Nobody can owe you money late on a document
  you never sent, and the Costa job screen read "29 days overdue" beside a row
  the product believed had never left the building.

  It was not one invoice. Thirteen of the fourteen demo invoices had `sent_at`
  null while carrying a status only a sent invoice can reach - sent, partial,
  paid, overdue - and four of those also carried a `viewed_at`, so a customer
  had opened something that had never been sent to them.

  `issued_on` is the send moment. Every `viewed_at` and `paid_at` in the demo
  already falls after its own `issued_on`, so the order of events stays true:
  raised, sent, opened, paid. Drafts keep a null `sent_at`, which is what a
  draft is.

  Three paid invoices had no `public_token` either - EAHS-001, HLR-001 and
  TDLN-001 - so there was no document for the customer who supposedly paid them
  to have read. They get one, generated the same way the send route does.

  Demo workspaces only: every statement is fenced on `orgs.is_demo`.
*/

update public.job_invoices i
   set sent_at = (i.issued_on::timestamp at time zone 'UTC')
  from public.orgs o
 where o.id = i.org_id
   and o.is_demo
   and i.status in ('sent', 'partial', 'paid', 'overdue')
   and i.sent_at is null;

/*
  A document somebody paid should be one they could open.

  36 hex characters, the same shape the share route makes with
  `crypto.randomBytes(18)`. Built from `gen_random_uuid`, which is in the core
  server; `gen_random_bytes` would need pgcrypto, which this database does not
  have installed.
*/
update public.job_invoices i
   set public_token = replace(gen_random_uuid()::text, '-', '')
                   || substr(replace(gen_random_uuid()::text, '-', ''), 1, 4)
  from public.orgs o
 where o.id = i.org_id
   and o.is_demo
   and i.status <> 'draft'
   and i.public_token is null;

/*
  A draft has not been sent, whatever else is on the row. Nothing in the demo
  is in that state today; this is here so the rule is written down next to the
  repair rather than only in a commit message.
*/
update public.job_invoices i
   set sent_at = null
  from public.orgs o
 where o.id = i.org_id
   and o.is_demo
   and i.status = 'draft'
   and i.sent_at is not null;
