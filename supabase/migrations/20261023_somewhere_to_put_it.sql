-- Somewhere to put it.
--
-- The gap: every place that holds a file in here hangs off something that
-- already exists. Client assets hang off a client, the brand kit off a
-- business, records off a job. So Alex Ward's logos — a man who is not a
-- client and may never be — have nowhere to live, and the honest answer to
-- "where do these go" was "nowhere".
--
-- One table, two ways in, on purpose:
--
--   * Filed on arrival. Drop something on a person's card and it is theirs
--     immediately. filed_at is set, it never appears in the inbox.
--   * Unfiled. Drop it anywhere and answer "who is this about" later, or
--     never. filed_at is null and it waits in one list.
--
-- Both write the same row, so nothing has to be migrated between them and
-- neither path is the second-class one.
--
-- Files go in the existing `documents` bucket under the same {org}/{uuid}
-- convention. A new bucket would mean new storage policies, and the ones on
-- documents are already right.

create table if not exists drops (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references orgs(id) on delete cascade,
  added_by     uuid references auth.users(id) on delete set null,

  kind         text not null check (kind in ('file', 'image', 'link', 'note')),
  title        text,
  -- The note itself, or the URL. One column because a link is a note that
  -- happens to be addressable.
  body         text,

  storage_path text,
  mime         text,
  bytes        bigint,

  -- Where it was filed. At most one should be set; a thing is about a person
  -- or a client or a job, and "all three" is how a filing system becomes a
  -- search problem.
  person_id    uuid references customer_contacts(id) on delete set null,
  customer_id  uuid references customers(id) on delete set null,
  job_id       uuid references jobs(id) on delete set null,

  -- What was worked out on arrival, cheaply and once. A palette for an image,
  -- a title for a link. Never anything that costs per read.
  meta         jsonb not null default '{}'::jsonb,

  -- Null means it is still in the inbox. This is the whole state machine.
  filed_at     timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists drops_org      on drops (org_id, created_at desc);
create index if not exists drops_unfiled  on drops (org_id, created_at desc) where filed_at is null;
create index if not exists drops_person   on drops (person_id)   where person_id   is not null;
create index if not exists drops_customer on drops (customer_id) where customer_id is not null;
create index if not exists drops_job      on drops (job_id)      where job_id      is not null;

alter table drops enable row level security;

drop policy if exists drops_mine on drops;
create policy drops_mine on drops
  for all
  using (
    exists (
      select 1 from memberships m
       where m.user_id = auth.uid() and m.org_id = drops.org_id
    )
  )
  with check (
    exists (
      select 1 from memberships m
       where m.user_id = auth.uid() and m.org_id = drops.org_id
    )
  );

comment on table drops is
  'Anything that arrived without a home: a prospect''s logo, a screenshot, a link, a scribbled note. filed_at null means it is still in the inbox. Dropping onto a record files it on arrival; dropping into the inbox defers the question.';
