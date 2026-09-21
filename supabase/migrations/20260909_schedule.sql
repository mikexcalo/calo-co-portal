-- ============================================================================
-- A SCHEDULE THAT MOVES WHEN THE JOB MOVES
-- ============================================================================
-- Jobs had a start and an end and nothing in between, so "where are we on the
-- Brown kitchen" was answered from memory or from a text thread.
--
-- THE PART THAT MATTERS IS THE SHIFTING
--
-- Anyone can keep a list of dates. The reason a contractor stops trusting a
-- schedule is that drywall slips two days, nobody moves the eleven things
-- behind it, and within a week the schedule says Thursday while the job says
-- next Tuesday. A schedule that is wrong is worse than no schedule, because
-- people stop looking and then miss the one date that mattered.
--
-- So dependents move automatically. Push drywall and everything waiting on it
-- moves by the same number of days, in the database, without anybody
-- remembering to.
-- ============================================================================

create table if not exists public.job_tasks (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references orgs(id) on delete cascade,
  job_id     uuid not null references jobs(id) on delete cascade,

  name       text not null,
  starts_on  date,
  ends_on    date,

  /**
   * Free text, not a user reference.
   *
   * The drywall crew does not have a login and never will. Insisting on an
   * account before a name can be written down is how a schedule ends up
   * half-filled and abandoned.
   */
  assignee   text,

  status     text not null default 'not_started'
             check (status in ('not_started', 'in_progress', 'done', 'blocked')),

  -- What this waits on. Self-referencing, and set null on delete so removing a
  -- step never silently deletes the work that followed it.
  depends_on uuid references job_tasks(id) on delete set null,

  position   int not null default 0,
  note       text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists job_tasks_job_idx on public.job_tasks(job_id, position);
create index if not exists job_tasks_dates_idx on public.job_tasks(org_id, starts_on);
create index if not exists job_tasks_depends_idx on public.job_tasks(depends_on);

alter table public.job_tasks enable row level security;

drop policy if exists job_tasks_own on public.job_tasks;
create policy job_tasks_own on public.job_tasks
  for all to authenticated
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

-- A step cannot end before it starts. Cheap to enforce, and the alternative is
-- a negative-length bar on a chart nobody can explain.
alter table public.job_tasks drop constraint if exists job_tasks_dates_sane;
alter table public.job_tasks add constraint job_tasks_dates_sane
  check (starts_on is null or ends_on is null or ends_on >= starts_on);

-- ---------------------------------------------------------------------------
-- The cascade.
--
-- When a step's end date moves, everything waiting on it moves by the same
-- number of days, and so does everything waiting on those.
--
-- Depth-limited rather than trusting the data to be acyclic. Somebody will
-- eventually make A wait on B and B wait on A, and an unbounded recursive
-- trigger turns that mistake into a hung database rather than a wrong date.
-- ---------------------------------------------------------------------------

create or replace function public.shift_dependents()
returns trigger language plpgsql as $function$
declare
  delta int;
  depth int;
begin
  if new.ends_on is null or old.ends_on is null or new.ends_on = old.ends_on then
    return new;
  end if;

  /**
   * Direct dependents only, once.
   *
   * The first version walked the chain itself AND left the trigger firing on
   * its own updates, so every step two levels down moved twice: drywall slips
   * three days, paint moves three, trim moves six. Both mechanisms were
   * correct on their own and wrong together.
   *
   * Postgres already recurses here, so shifting one level is the whole job.
   * The counter exists only to survive a cycle somebody creates by accident,
   * where the recursion would otherwise not terminate.
   */
  depth := coalesce(current_setting('app.shift_depth', true), '0')::int;
  if depth > 20 then
    return new;
  end if;
  perform set_config('app.shift_depth', (depth + 1)::text, true);

  delta := new.ends_on - old.ends_on;

  update job_tasks t
     set starts_on  = t.starts_on + delta,
         ends_on    = t.ends_on + delta,
         updated_at = now()
   where t.depends_on = new.id
     and t.status <> 'done'          -- finished work does not move
     and t.ends_on is not null;

  perform set_config('app.shift_depth', depth::text, true);
  return new;
end;
$function$;

drop trigger if exists job_tasks_cascade on public.job_tasks;
create trigger job_tasks_cascade
  after update of ends_on on public.job_tasks
  for each row execute function public.shift_dependents();

comment on table public.job_tasks is
  'Steps within a job, with dependencies. Moving one moves everything behind it, because a schedule people stop trusting is worse than none.';

-- ---------------------------------------------------------------------------
-- The week ahead, across every job.
--
-- One query rather than one per job, because the question is "what is
-- happening this week", not "what is happening on the Brown kitchen".
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
    -- Late means it should have finished and has not. Stated here so every
    -- screen agrees on what late means.
    (t.ends_on < current_date and t.status <> 'done') as overdue
  from job_tasks t
  join jobs j on j.id = t.job_id
  left join customers c on c.id = j.customer_id
  where t.status <> 'done'
  order by t.starts_on nulls last, t.position;
