-- ============================================================================
-- NOTIFICATIONS THAT FIRE ON A DATE, NOT ON A CLICK
-- ============================================================================
-- Every notification in the product so far is reactive: somebody accepted an
-- estimate, a payment landed, a lead came in. All of them happen because a
-- person did something.
--
-- Nothing fires because a date arrived. "Drywall starts tomorrow" and "this
-- invoice went past due on Tuesday" were invisible unless somebody opened the
-- right screen on the right day, which is exactly the class of thing people
-- open software to avoid.
--
-- pg_cron runs this once a day. No server, no queue, nothing to keep alive.
-- ============================================================================

create extension if not exists pg_cron with schema extensions;

-- ---------------------------------------------------------------------------
-- Sent once, not once a day.
--
-- Without a key, the same "starts tomorrow" notice reappears every morning
-- until the date passes, and a feed that repeats itself gets ignored inside a
-- week. The key is what the notice is about, so re-running the job is free.
-- ---------------------------------------------------------------------------

alter table public.notifications
  add column if not exists dedupe_key text;

create unique index if not exists notifications_dedupe
  on public.notifications(org_id, dedupe_key)
  where dedupe_key is not null;

comment on column public.notifications.dedupe_key is
  'What this notice is about, so a daily job can run repeatedly without repeating itself.';

-- ---------------------------------------------------------------------------
-- The daily pass.
--
-- Deliberately narrow. Four things worth being told about unprompted, chosen
-- because each has a cost attached to missing it. Anything that is merely
-- interesting stays on the screens where it lives; a notification feed earns
-- its place by being short.
-- ---------------------------------------------------------------------------

create or replace function public.daily_notices()
returns int
language plpgsql
security definer
set search_path = public
as $function$
declare
  made int := 0;
begin
  -- 1. Work starting tomorrow. One notice per job rather than per step,
  --    because "four things start tomorrow on the Brown kitchen" is one piece
  --    of news and four notices about it is noise.
  with starting as (
    select t.org_id, t.job_id, j.name as job_name, count(*) as n
    from job_tasks t
    join jobs j on j.id = t.job_id
    where t.starts_on = current_date + 1
      and t.status not in ('done')
    group by t.org_id, t.job_id, j.name
  )
  insert into notifications (org_id, kind, title, body, href, dedupe_key)
  select
    org_id,
    'schedule',
    case when n = 1 then 'One thing starts tomorrow' else n || ' things start tomorrow' end,
    job_name,
    '/jobs/' || job_id,
    'starts:' || job_id || ':' || (current_date + 1)
  from starting
  on conflict do nothing;
  get diagnostics made = row_count;

  -- 2. Work that should have finished and has not.
  insert into notifications (org_id, kind, title, body, href, dedupe_key)
  select
    t.org_id,
    'schedule',
    t.name || ' is late',
    j.name || ', due ' || to_char(t.ends_on, 'Mon DD'),
    '/jobs/' || t.job_id,
    'late:' || t.id || ':' || t.ends_on
  from job_tasks t
  join jobs j on j.id = t.job_id
  where t.ends_on < current_date
    and t.status <> 'done'
  on conflict do nothing;

  -- 3. Reminders reaching their date.
  insert into notifications (org_id, kind, title, body, href, dedupe_key)
  select
    r.org_id,
    'reminder',
    r.body,
    coalesce(c.name, 'Reminder'),
    case when r.customer_id is not null then '/customers/' || r.customer_id else '/' end,
    'reminder:' || r.id
  from reminders r
  left join customers c on c.id = r.customer_id
  where r.due_on <= current_date
    and r.done_at is null
  on conflict do nothing;

  -- 4. Invoices past due. Money is the one thing worth being told about twice,
  --    so the key includes the week: it repeats weekly rather than daily.
  insert into notifications (org_id, kind, title, body, href, dedupe_key)
  select
    i.org_id,
    'invoice_overdue',
    'Invoice past due',
    coalesce(c.name, 'A customer') || ', ' || to_char(i.total - i.amount_paid, 'FM$999,999,990.00') || ' outstanding',
    '/billing',
    'overdue:' || i.id || ':' || to_char(current_date, 'IYYY-IW')
  from job_invoices i
  left join jobs j on j.id = i.job_id
  left join customers c on c.id = j.customer_id
  where i.status <> 'void'
    and i.due_on < current_date
    and i.total > i.amount_paid
  on conflict do nothing;

  return made;
end;
$function$;

revoke all on function public.daily_notices() from public;

comment on function public.daily_notices() is
  'The four date-driven notices worth interrupting somebody for. Idempotent: safe to run repeatedly, because a feed that repeats itself gets ignored within a week.';

-- ---------------------------------------------------------------------------
-- Seven in the morning, every morning.
--
-- Before a working day starts rather than during it. A notice about tomorrow
-- arriving at four in the afternoon is a notice about tonight.
-- ---------------------------------------------------------------------------

select cron.unschedule('daily-notices')
  where exists (select 1 from cron.job where jobname = 'daily-notices');

select cron.schedule('daily-notices', '0 12 * * *', $cron$select public.daily_notices();$cron$);

-- ---------------------------------------------------------------------------
-- Two new kinds.
--
-- The existing list was written when every notification came from something a
-- person did. Date-driven notices are a different category and are worth
-- filtering separately, so they get their own names rather than being filed
-- under 'system' where nothing can tell them apart.
--
-- invoice_overdue already existed and is reused rather than duplicated.
-- ---------------------------------------------------------------------------

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('lead', 'invoice_paid', 'invoice_overdue', 'site_request',
                  'document', 'system', 'schedule', 'reminder'));
