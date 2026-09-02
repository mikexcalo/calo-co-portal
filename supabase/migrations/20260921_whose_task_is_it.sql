-- ============================================================================
-- WHOSE PROBLEM IS THIS
-- ============================================================================
-- A schedule holds every step in a piece of work, and most of those steps are
-- not yours. John Litton's business setup has sixteen: two are the agency's,
-- the rest belong to John, his attorney and his CPA.
--
-- All sixteen were landing in the agency's week, the agency's late-work notice
-- and the agency's dashboard, which turns a plan you are helping run into a
-- list of things you appear to owe. The effect is the same as a notification
-- feed that repeats itself: you stop reading it, and then you miss the two
-- that were actually yours.
--
-- assignee already recorded who, as free text, because the drywall crew and
-- the attorney will never have logins. What was missing was the only part a
-- query can act on: whether it is on us.
-- ============================================================================

alter table public.job_tasks
  add column if not exists owner text not null default 'us'
    check (owner in ('us', 'client', 'third_party'));

comment on column public.job_tasks.owner is
  'Whose plate this is on. Only "us" appears in your week and your reminders; the rest are tracked and shown on the client record, because a plan you are helping run is not a list of things you owe.';

-- ---------------------------------------------------------------------------
-- Your week is yours again.
--
-- Everything else stays visible on the client's plan. It is not hidden, it is
-- just not chased, which is the difference between tracking somebody's project
-- and being handed it.
-- ---------------------------------------------------------------------------

create or replace view public.week_ahead as
  select
    t.id,
    t.org_id,
    t.job_id,
    j.name  as job_name,
    c.name  as customer_name,
    t.name,
    t.starts_on,
    t.ends_on,
    t.status,
    t.assignee,
    (t.ends_on < current_date and t.status <> 'done') as overdue,
    t.owner
  from job_tasks t
  join jobs j on j.id = t.job_id
  left join customers c on c.id = j.customer_id
  where t.status <> 'done'
    and t.owner = 'us'
  order by t.starts_on nulls last, t.position;

comment on view public.week_ahead is
  'What is on your plate this week. Steps owned by a client or a third party are deliberately absent: they belong on the client record, not in your reminders.';
