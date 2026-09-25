/*
  Work in it: a client lets the studio edit, and sees everything it did.

  TWO TABLES, AND WHY NOT ONE COLUMN

  The obvious build is two booleans on feedback. It was considered and it is
  wrong. A help request is a message: it is written once, answered, and closed.
  A grant is an authorisation: it starts, it is used, and it ends, and it has
  to be endable without touching the message that happened to create it. Put
  them in one row and "the client took permission back" becomes an edit to a
  note, "the note was never closed" becomes standing permission, and there is
  no way to grant access without a complaint attached.

  So: the request stays in feedback with kind = 'help', which is the table that
  already carries client-to-studio messages and already has a policy letting
  the studio read them. The grant lives here.

  WHAT A GRANT IS NOT

  It is not a privilege. The studio owner already holds an owner membership in
  every client workspace it set up - that is the three-tier shape this product
  is built on - so the database already permits every edit and every send in
  those workspaces, with or without a row in this table. Nothing here widens
  what is possible.

  What it is: a record of consent, and a switch the product obeys. The app
  refuses to send when can_send is false. The database would not. That is the
  same boundary View mode draws and it is worth saying in both directions:
  it stops the product, not the person. A version enforced against the person
  needs sends routed through a server that checks this table with the service
  role AND the studio's own membership narrowed so the direct path is gone.
  That is noted in docs/handoff.md as its own brief.

  WHY revoked_at RATHER THAN DELETE

  "The client can take permission back at any time" has to leave a trace.
  Deleting the row would make a workspace that was worked in indistinguishable
  from one that never was, which is exactly the question somebody asks three
  months later.
*/

create table if not exists public.work_grants (
  id           uuid primary key default gen_random_uuid(),
  /* The workspace being worked in, not the studio doing the work. */
  org_id       uuid not null references public.orgs(id) on delete cascade,
  /* The request that created it, where a client asked. Null when the studio
     went in on its own, which is allowed and is announced differently. */
  feedback_id  uuid references public.feedback(id) on delete set null,
  /* Who said yes. Null for a studio-initiated session: nobody said yes. */
  granted_by   uuid references auth.users(id) on delete set null,
  /* Who it is for. The studio person who will be named in every notice. */
  granted_to   uuid not null references auth.users(id) on delete cascade,
  can_edit     boolean not null default true,
  can_send     boolean not null default false,
  granted_at   timestamptz not null default now(),
  revoked_at   timestamptz,
  /* Set when the studio presses "Done, hand it back". Distinct from revoked:
     one is the studio finishing, the other is the client stopping it. */
  ended_at     timestamptz
);

create index if not exists work_grants_live
  on public.work_grants (org_id, granted_to)
  where revoked_at is null and ended_at is null;

alter table public.work_grants enable row level security;

/*
  Anybody in the workspace can see and change its grants.

  Deliberately symmetrical. The client needs to revoke and the studio needs to
  read; both are members of the org, and a policy that let only one side act
  would mean the client could grant permission and not withdraw it.
*/
create policy work_grants_org on public.work_grants
  for all to authenticated
  using (exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.org_id = work_grants.org_id))
  with check (exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.org_id = work_grants.org_id));

/*
  What was actually changed, so the notice is a fact rather than a summary.

  The client is promised "he changed the Kinney Ave estimate". That sentence
  has to come from somewhere, and the only honest somewhere is a row written
  at the moment of the write. Reconstructing it afterwards from updated_at
  guesses, and a guess in this particular sentence is a guess about somebody
  else's money.

  One row per write, recorded at the same choke point that refuses writes in
  View mode, so no screen has to remember to log anything.
*/
create table if not exists public.work_changes (
  id         bigserial primary key,
  grant_id   uuid not null references public.work_grants(id) on delete cascade,
  org_id     uuid not null references public.orgs(id) on delete cascade,
  /* Who made it. Always the studio person; recorded rather than assumed. */
  actor_id   uuid not null references auth.users(id) on delete cascade,
  /* What was touched: the table, and the row where one id was involved. */
  entity     text not null,
  entity_id  uuid,
  /* insert, update, upsert or delete, as the client saw it happen. */
  action     text not null,
  /* A human label for the thing, captured at write time because the row may
     be gone by the time anybody reads this. */
  label      text,
  at         timestamptz not null default now()
);

create index if not exists work_changes_grant on public.work_changes (grant_id, at desc);
create index if not exists work_changes_org on public.work_changes (org_id, at desc);

alter table public.work_changes enable row level security;

/*
  Readable by the workspace, writable only as yourself.

  The client must be able to read what was done to their data - that is the
  whole promise - and nobody should be able to write a change record under
  somebody else's name.
*/
create policy work_changes_read on public.work_changes
  for select to authenticated
  using (exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.org_id = work_changes.org_id));

create policy work_changes_write on public.work_changes
  for insert to authenticated
  with check (
    actor_id = auth.uid()
    and exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.org_id = work_changes.org_id)
  );

comment on table public.work_grants is
  'Consent for the studio to edit, and optionally send, in a client workspace. Not a privilege: the studio already holds an owner membership. The app obeys it; the database does not.';
comment on table public.work_changes is
  'One row per write made during a work session, so the notice to the client is a record rather than a summary.';
