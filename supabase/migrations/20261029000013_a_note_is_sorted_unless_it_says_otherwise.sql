/*
  A note nobody needs to read is not a note waiting to be read.

  `sorted_at` was added with no default, so every insert that does not name it
  lands NULL - and NULL is the state that means "saved as typed, never read".
  The backfill in 20261029000009 stamped every row that existed, which is why
  this looked fine: the whole table was sorted and stayed that way until
  something new was written.

  Everything written since is wrong in one of two ways.

  A note that HAS been through the reader - the note screen's read path, and
  DropIt's fileIt - arrives with a title, a summary and a recorded cost, and
  says it has never been read. Both call sites now stamp it explicitly,
  because the intent belongs where the row is built.

  A note the reader was never going to touch - a lead coming in, a proposal
  accepted, an inbound email, an update sent, a note typed on a customer
  record - also arrives NULL, and `JobNotes` reads NULL as "offer Sort it".
  So the product was offering a paid re-read on notes that were either
  already read or were never raw text in the first place. That is the same
  double-spend the drops shelf was doing, one table over.

  The default fixes both classes at once and cannot be forgotten by the next
  caller. Deliberately-unread paths are unaffected: they pass `sorted_at:
  null` explicitly, and an explicit NULL beats a column default.
*/

alter table public.customer_notes
  alter column sorted_at set default now();

comment on column public.customer_notes.sorted_at is
  'When this note stopped waiting for the reader. Defaults to now(), because a note is only unread if its writer says so. Null means it was saved as typed and deliberately left for the reader later - the note is whole, it just has no title or summary yet. Only DropIt''s Save note and the note screen''s Save note write null.';

-- Anything written between 20261029000009 and this migration that was read
-- but not stamped. A recorded cost or a source of 'transcript' is proof
-- something went through it; raw saves have neither.
update public.customer_notes
   set sorted_at = coalesce(sorted_at, created_at)
 where sorted_at is null
   and (extraction_cost_cents is not null or source <> 'typed' or title is not null);
