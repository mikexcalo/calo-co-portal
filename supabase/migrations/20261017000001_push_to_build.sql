-- Publishing has to reach somebody who can change the code.
--
-- The section editor stores a draft, previews it, and copies the draft over
-- the published version. All of that is true inside this platform and none of
-- it touches calo.company, which is a different repository on a different
-- deployment. So "set it live" was, until now, a word for moving a row.
--
-- The honest loop, and the one that was asked for: edit here, look at the
-- preview, and when it is right, push it out as a request with the exact
-- before and after. Somebody with the site checked out makes it real. The
-- platform is where the decision happens; the repo is where it lands.
--
-- WHY THE WHOLE BEFORE AND AFTER
--
-- A request saying "the hero changed" costs a conversation. A request holding
-- both versions of every field is something a person can act on without asking
-- a single question, which is the difference between a handoff and a ticket.

create table if not exists site_change_requests (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,

  -- Null once the section is deleted; the request still describes real work.
  section_id  uuid references site_sections(id) on delete set null,
  kind        text not null,
  variant     text not null,

  -- Both sides, kept whole, so nobody has to reconstruct what changed.
  before      jsonb,
  after       jsonb not null,
  -- Which fields actually moved. Derived on write, because working it out
  -- later means guessing about keys that were absent versus empty.
  changed     text[] not null default '{}',

  note        text,
  status      text not null default 'open'
              check (status in ('open', 'building', 'done', 'dropped')),

  created_at  timestamptz not null default now(),
  closed_at   timestamptz
);

create index if not exists site_change_requests_open
  on site_change_requests (org_id, status, created_at desc);

alter table site_change_requests enable row level security;

drop policy if exists site_change_requests_own on site_change_requests;
create policy site_change_requests_own on site_change_requests
  for all using (org_id = current_org_id()) with check (org_id = current_org_id());

comment on table site_change_requests is
  'A section edit pushed out to be made real in the site repo. Holds both versions so it can be acted on without a conversation.';
