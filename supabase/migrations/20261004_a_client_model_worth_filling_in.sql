-- ============================================================================
-- CATEGORIES A CONSULTANT WOULD ACTUALLY KEEP
-- ============================================================================
-- The brief had four buckets: who they are, what we are doing, where it has
-- got to, what is stuck. Every one of them is prose, and prose is where
-- specifics go to die. Global Seafood proved it. John wrote a clean executive
-- summary of his own opportunity, and what came out the other end was that he
-- is sixty-nine. The shape decided what survived.
--
-- Eight fields now, each answering one question a consultant is actually asked
-- and none of them a place to put "background". The test each had to pass: can
-- you be wrong about it? "Who they are" cannot be wrong. "How the money works"
-- can, and being wrong about it matters.
--
-- WHY THIS IS THE THING A TRANSCRIPT FILLS
--
-- Dropping a call recording into a client should update named fields, not
-- append to a paragraph. Named fields can be diffed, argued with, and left
-- alone when the transcript says nothing about them. A single prose blob can
-- only be rewritten wholesale, which is why nobody ever does.
-- ============================================================================

/**
 * Who you are waiting on, out of the prose and into its own field.
 *
 * It was a sentence inside `stuck`, which meant it took a paragraph of space,
 * could not be sorted or counted, and had no way to be cleared other than
 * rewriting the paragraph around it. awaiting_reply_since already existed and
 * held the date; it just had nothing to say what the wait was for.
 */
alter table public.customers
  add column if not exists waiting_on text;

comment on column public.customers.waiting_on is
  'What you are waiting for, in a few words. Pairs with awaiting_reply_since, which holds since when. One line on screen with a control to clear it, rather than a paragraph nobody can update.';

comment on column public.customers.brief is
  'The client model: opportunity, offer, buyers, edge, economics, gtm, constraints, ours. Named fields so a transcript can update one without rewriting the rest.';

-- ---------------------------------------------------------------------------
-- Carry the old shape forward. Nothing is thrown away: what was written under
-- the old headings moves to the closest new one, and the wait moves out to
-- its own column.
-- ---------------------------------------------------------------------------

update public.customers
   set brief = jsonb_strip_nulls(
         jsonb_build_object(
           'opportunity', brief ->> 'who',
           'ours',        brief ->> 'doing',
           'gtm',         brief ->> 'where'
         )
       ),
       waiting_on = coalesce(waiting_on, brief ->> 'stuck')
 where brief ? 'who' or brief ? 'doing' or brief ? 'where' or brief ? 'stuck';
