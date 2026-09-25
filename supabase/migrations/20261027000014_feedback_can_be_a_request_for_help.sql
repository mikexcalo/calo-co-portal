/*
  feedback.kind could not hold 'help'.

  The check constraint listed the three kinds the Tell Us box offers - idea,
  broken, confusing - all of which are things somebody says about the SOFTWARE.
  A request for help is a thing somebody says about their own BUSINESS, and it
  belongs in the same table because it travels the same path: written by the
  client, read by the studio, answered, closed.

  Found the way constraints are usually found: the insert failed, human() turned
  22P02 into "Something in that is not a value this will accept", and the client
  saw a form that would not send with no idea why. Worth noting that the failure
  was loud and correct. The alternative design, a kind column with no constraint,
  would have accepted 'help' silently on the first try and accepted 'halp' just
  as silently on the hundredth.
*/

alter table public.feedback drop constraint if exists feedback_kind_check;

alter table public.feedback add constraint feedback_kind_check
  check (kind = any (array['idea'::text, 'broken'::text, 'confusing'::text, 'help'::text]));

comment on constraint feedback_kind_check on public.feedback is
  'idea, broken and confusing are about the software. help is about the client''s own business and opens a work session.';
