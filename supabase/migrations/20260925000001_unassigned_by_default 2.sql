-- ============================================================================
-- NOBODY OWNS A TASK UNTIL SOMEBODY SAYS SO
-- ============================================================================
-- Sixteen steps went onto John's plan and I decided which three were the
-- agency's. Nobody had agreed that. Two of them then filled up a week view
-- headed Today, which is the strongest claim the product can make about a
-- piece of work: this is yours, now.
--
-- The honest default is that a step has no owner until a person picks one. An
-- unowned step is still on the plan, still has dates, still moves when the
-- thing before it slips. It just does not appear in anybody's day.
--
-- This is the same failure as putting the client's tasks in your week, one
-- level up: the product asserting something nobody told it.
-- ============================================================================

alter table public.job_tasks drop constraint if exists job_tasks_owner_check;
alter table public.job_tasks
  alter column owner set default 'unassigned';
alter table public.job_tasks add constraint job_tasks_owner_check
  check (owner in ('unassigned', 'us', 'client', 'third_party'));

comment on column public.job_tasks.owner is
  'Who is doing it. unassigned until somebody says, and only "us" reaches your week. A plan can be complete and correct with nothing assigned; deciding who does what is a separate conversation from deciding what needs doing.';

-- John's plan goes back to unassigned. Who does what has not been agreed, and
-- the schedule should say that rather than guess.
update public.job_tasks
   set owner = 'unassigned'
 where job_id = (select id from jobs where name = 'Business setup and launch');

-- week_ahead already filters to owner = 'us', so unassigned work correctly
-- disappears from Today without another change.
