-- ============================================================================
-- A NINE-STEP TASK NEEDS NINE TICKS, NOT ONE
-- ============================================================================
-- Setup items were done or not done. But "redirect mikecalo.co" is a morning's
-- work spread over a registrar, Wix, Vercel and a DNS wait, and a single Done
-- button at the end of it means the state between starting and finishing lives
-- in somebody's head. So you re-read all nine steps every time to work out
-- where you were, which is the reason a task like this gets abandoned halfway.
--
-- An array of indexes rather than a row per step: the steps are defined in code
-- and change when the instructions improve, so storing them as records would
-- mean migrating text every time a sentence gets better.
-- ============================================================================

alter table public.setup_items
  add column if not exists steps_done integer[] not null default '{}';

comment on column public.setup_items.steps_done is
  'Which steps are ticked, by index. An array because the steps live in code: storing them as rows would mean a migration every time the wording improves.';
