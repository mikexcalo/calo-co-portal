-- The description on a record had become an engineering note.
--
--   "Crew roles and responsibilities, 113 pages. Sent by Mark 27 Aug 2026.
--    Text is not machine-readable (embedded fonts), so it is stored as-is for
--    reference rather than indexed."
--
-- Three of those four facts are about the file rather than the manual, and the
-- last one is an apology for an indexing limitation written in the voice of
-- whoever hit it. Nobody opening a roles manual needs to be told about
-- embedded fonts.
--
-- The card shows the file name, the size and the date underneath on its own
-- line now, so the description does not have to carry them. What is left is
-- the job it was always supposed to do: what this is, and why you would reach
-- for it.

update public.business_files
   set description = 'How Mammoth runs a site: who does what, who reports to whom, '
                     'and what each crew role is accountable for. Mark''s own manual, '
                     'and the reference to settle anything about scope on a job.'
 where name = 'Roles and Responsibilities Manual'
   and description like '%machine-readable%';
