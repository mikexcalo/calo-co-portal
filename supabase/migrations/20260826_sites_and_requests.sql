-- ============================================================================
-- CLIENT SITES + CHANGE REQUESTS
-- ============================================================================
-- Two answers to "clients want flexibility with their sites", because they are
-- really two different asks wearing the same coat:
--
--   1. "Change the phone number / hours / headline"  -> site_content
--      Self-serve. The client edits a value, the site reads it, done. No
--      build, no approval, no waiting on anyone. This should absorb most
--      requests, and every request it absorbs is one nobody has to work.
--
--   2. "Add a gallery page"                          -> site_requests
--      Structural. Needs code. Goes into a queue, Mike approves or modifies,
--      and an approved request produces a build brief for an agent to pick up.
--
-- Getting (1) right is what makes (2) tolerable.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- sites — a website belonging to an org
-- ---------------------------------------------------------------------------

create table if not exists client_sites (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id) on delete cascade,

  name          text not null,
  url           text,
  -- Where an approved request gets filed, e.g. "mikexcalo/mammoth-construction-site"
  repo          text,
  -- Vercel project, so deploys can be linked from a request
  vercel_project text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists client_sites_updated_at on client_sites;
create trigger client_sites_updated_at before update on client_sites
  for each row execute function set_updated_at();

create index if not exists client_sites_org_idx on client_sites(org_id);

-- ---------------------------------------------------------------------------
-- site_content — the self-serve half
--
-- Simple key/value the live site reads. A client editing their phone number
-- should never involve a deploy, a developer, or a conversation.
-- ---------------------------------------------------------------------------

create table if not exists site_content (
  id            uuid primary key default gen_random_uuid(),
  site_id       uuid not null references client_sites(id) on delete cascade,
  org_id        uuid not null references orgs(id) on delete cascade,

  key           text not null,
  label         text not null,
  value         text,
  kind          text not null default 'text'
                  check (kind in ('text','longtext','url','email','phone','image','hours')),
  help          text,
  position      integer not null default 0,

  updated_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (site_id, key)
);

drop trigger if exists site_content_updated_at on site_content;
create trigger site_content_updated_at before update on site_content
  for each row execute function set_updated_at();

create index if not exists site_content_site_idx on site_content(site_id);

-- ---------------------------------------------------------------------------
-- site_requests — the build-needed half
-- ---------------------------------------------------------------------------

create table if not exists site_requests (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id) on delete cascade,
  site_id       uuid references client_sites(id) on delete set null,

  title         text not null,
  body          text not null,
  -- What the client wants; drives how it's triaged
  kind          text not null default 'change'
                  check (kind in ('copy','image','change','new_feature','bug','other')),
  urgency       text not null default 'normal'
                  check (urgency in ('whenever','normal','urgent')),

  status        text not null default 'submitted'
                  check (status in (
                    'submitted',    -- client sent it
                    'needs_info',   -- Mike asked a question
                    'approved',     -- Mike said build it
                    'building',     -- an agent picked it up
                    'shipped',      -- live
                    'declined'      -- not doing it
                  )),

  -- Mike's edit of the request before it goes to build. The whole point of
  -- "approve or modify": the brief that gets built is the one Mike okayed,
  -- not the one the client typed at midnight.
  approved_brief text,
  note_to_client text,

  requested_by  uuid references auth.users(id) on delete set null,
  requester_name text,
  requester_email text,

  -- Set when the request is handed off to be built
  issue_url     text,
  deploy_url    text,

  submitted_at  timestamptz not null default now(),
  decided_at    timestamptz,
  shipped_at    timestamptz,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists site_requests_updated_at on site_requests;
create trigger site_requests_updated_at before update on site_requests
  for each row execute function set_updated_at();

create index if not exists site_requests_org_idx on site_requests(org_id);
create index if not exists site_requests_status_idx on site_requests(org_id, status);
create index if not exists site_requests_open_idx
  on site_requests(org_id) where status in ('submitted','needs_info','approved','building');

-- ---------------------------------------------------------------------------
-- RLS — same org wall as everything else
-- ---------------------------------------------------------------------------

alter table client_sites  enable row level security;
alter table site_content  enable row level security;
alter table site_requests enable row level security;

drop policy if exists client_sites_org_wall on client_sites;
create policy client_sites_org_wall on client_sites
  for all to authenticated
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

drop policy if exists site_content_org_wall on site_content;
create policy site_content_org_wall on site_content
  for all to authenticated
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

drop policy if exists site_requests_org_wall on site_requests;
create policy site_requests_org_wall on site_requests
  for all to authenticated
  using (org_id = current_org_id())
  with check (org_id = current_org_id());
