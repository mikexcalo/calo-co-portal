/*
  A typed note that nobody has read yet is still a note.

  `DropIt` had one button, "Scan and sort", which posts the text to the
  extraction route. Where that route is unconfigured or unreachable it answers
  "Note reading is not configured yet" - and there was no second path, so the
  words somebody typed could not be kept at all. Found while walking a job on
  a phone, which is exactly where it bites: the note is being written standing
  on a roof, and the answer to a service being down cannot be "type it again
  later".

  `sorted_at` is the whole of it. Null means the text is saved as typed and
  has never been through the reader, which is a state rather than a source -
  the note was still typed, and overwriting `source` to say otherwise would
  lose that. Filling it in is what sorting does, so a note can be picked up
  later from wherever it was saved.

  Every note that exists today went through the reader, so they are stamped
  as sorted rather than left looking like a backlog nobody has.
*/

alter table public.customer_notes
  add column if not exists sorted_at timestamptz;

update public.customer_notes
   set sorted_at = coalesce(sorted_at, created_at)
 where sorted_at is null;

comment on column public.customer_notes.sorted_at is
  'When the reader last made sense of this note. Null means it was saved as typed and never read - the note is whole, it just has no title or summary yet.';

create index if not exists customer_notes_unsorted
  on public.customer_notes (org_id, created_at desc)
  where sorted_at is null;
