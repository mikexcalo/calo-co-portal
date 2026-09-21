-- Somebody using this should be able to say what is missing, from where they
-- noticed it.
--
-- Feedback currently arrives as a text message, or in a conversation three days
-- later, by which point the person has forgotten which screen they were on and
-- what they were trying to do. Both of those are the useful half.
--
-- WHY IT IS NOT A NOTE
--
-- Capture files against a client, inside one workspace, as a record of what
-- happened with them. This is the opposite: it is about the product rather than
-- the work, and it has to travel out of the workspace it was written in and
-- reach whoever can act on it.
--
-- WHY THE POLICY IS MEMBERSHIP AND NOT current_org_id()
--
-- Every other table here is walled to the workspace you are looking at, which
-- is right for a client list and wrong for this: an agency owner needs to read
-- what a tester wrote in her own workspace without switching into it first, or
-- it is not an inbox, it is five inboxes nobody checks. Membership is the
-- honest boundary — you can read feedback from a workspace you belong to, and
-- no others.

create table if not exists feedback (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  author_id   uuid references auth.users(id) on delete set null,

  -- What kind of thing this is, because the three want different responses and
  -- lumping them together means the broken ones wait behind the ideas.
  kind        text not null default 'idea'
              check (kind in ('idea', 'broken', 'confusing')),

  body        text not null check (length(body) between 1 and 4000),
  -- Where they were standing. Captured rather than asked, because "which
  -- screen" is the question people cannot answer afterwards.
  page        text,

  status      text not null default 'open'
              check (status in ('open', 'building', 'done', 'wont')),
  reply       text,

  created_at  timestamptz not null default now(),
  closed_at   timestamptz
);

create index if not exists feedback_open on feedback (status, created_at desc);
create index if not exists feedback_org on feedback (org_id, created_at desc);

alter table feedback enable row level security;

drop policy if exists feedback_mine on feedback;
create policy feedback_mine on feedback
  for all
  using (
    exists (
      select 1 from memberships m
       where m.user_id = auth.uid() and m.org_id = feedback.org_id
    )
  )
  with check (
    exists (
      select 1 from memberships m
       where m.user_id = auth.uid() and m.org_id = feedback.org_id
    )
  );

comment on table feedback is
  'What somebody using this says they need. Readable by anyone who belongs to that workspace, so an agency owner sees a tester''s notes without switching into her workspace.';
