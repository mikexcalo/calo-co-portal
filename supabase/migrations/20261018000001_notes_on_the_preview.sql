-- A client can mark up the preview without an account.
--
-- The preview link already works the way a staging link should: no login, opens
-- on a phone, safe to send. What it could not do was take a reply, so feedback
-- came back as an email saying "the second bit reads oddly" and somebody had to
-- work out which section that was.
--
-- A note is attached to the section it is about. That is the whole feature: the
-- comment and the thing it concerns arrive together, so nobody reconstructs the
-- mapping later.
--
-- WHY THIS ACCEPTS WRITES FROM A PUBLIC PAGE
--
-- Because the person with the opinion has no account and should not need one.
-- The token is the credential: it names exactly one site, it is random, and it
-- can be rotated to revoke every link at once. Length is capped and the section
-- must belong to the token's org, so the worst case is somebody who was given a
-- link leaving notes on the site they were given a link to.

create table if not exists site_feedback (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  -- Null means a note about the page rather than one section.
  section_id  uuid references site_sections(id) on delete cascade,

  -- Whoever they said they were. Not verified and not pretending to be.
  author      text,
  body        text not null check (length(body) between 1 and 2000),

  resolved    boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists site_feedback_open
  on site_feedback (org_id, resolved, created_at desc);

alter table site_feedback enable row level security;

-- Reading and clearing notes is yours. Writing them happens through the server
-- with the service key, gated on the preview token, because the person leaving
-- the note has no session to be scoped by.
drop policy if exists site_feedback_own on site_feedback;
create policy site_feedback_own on site_feedback
  for all using (org_id = current_org_id()) with check (org_id = current_org_id());

comment on table site_feedback is
  'Notes left on a preview by somebody without an account. Attached to the section they are about, so the comment and its subject arrive together.';
