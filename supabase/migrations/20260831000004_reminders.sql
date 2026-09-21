-- ============================================================================
-- REMINDERS
-- ============================================================================
-- customers.next_action already existed and holds exactly one thing per
-- client, which is one fewer than most relationships need. "Send the quote"
-- and "chase the deposit" are both true at once, and the second overwrites the
-- first.
--
-- More to the point, nothing carried a reminder for a job. "Order the tile
-- before Thursday" belongs to the job, not to the person who owns it.
--
-- The distinction that makes this worth building rather than leaving as a
-- note: a note is passive. It waits for somebody to open the right page. A
-- reminder has a date, so it comes and finds you. That is the whole difference
-- between a system and a notepad.
-- ============================================================================

create table if not exists public.reminders (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  customer_id uuid references customers(id) on delete cascade,
  job_id      uuid references jobs(id) on delete cascade,
  body        text not null,
  due_on      date not null,
  done_at     timestamptz,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

-- Partial index: the only query that runs often is "what is outstanding", and
-- finished reminders pile up forever without ever being asked about again.
create index if not exists reminders_open_idx
  on public.reminders(org_id, due_on) where done_at is null;

create index if not exists reminders_customer_idx
  on public.reminders(customer_id) where done_at is null;

alter table public.reminders enable row level security;

drop policy if exists reminders_own on public.reminders;
create policy reminders_own on public.reminders
  for all to authenticated
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

comment on table public.reminders is
  'Things to do on a date, attached to a client or a job. A note waits to be found; a reminder comes and finds you.';
