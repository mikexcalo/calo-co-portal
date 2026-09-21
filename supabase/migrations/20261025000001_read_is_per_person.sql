-- Read is a fact about a person, not about a notification.
--
-- notifications.read_at is one column shared by everybody in a workspace, so
-- an agency owner looking in on a client's account and pressing Done cleared
-- the task off the client's screen too. The client then never sees the thing
-- they were being asked to do, and nobody can tell that happened.
--
-- Whether *you* have dealt with something is a row about you.

create table if not exists notification_reads (
  notification_id uuid not null references notifications(id) on delete cascade,
  user_id         uuid not null references auth.users(id)    on delete cascade,
  read_at         timestamptz not null default now(),
  primary key (notification_id, user_id)
);

create index if not exists notification_reads_user on notification_reads (user_id);

alter table notification_reads enable row level security;

-- Your own reads, and nobody else's. Reading somebody else's row would say
-- when they dealt with something, which is not the agency's business.
drop policy if exists notification_reads_mine on notification_reads;
create policy notification_reads_mine on notification_reads
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

comment on table notification_reads is
  'Who has dismissed which notification. Separate from notifications.read_at, which stays for anything genuinely settled for the whole business — an invoice being paid is not something each person dismisses individually.';
