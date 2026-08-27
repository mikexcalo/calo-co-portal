-- ============================================================================
-- BUSINESS FILES — the documents a company has to keep
-- ============================================================================
-- Deliberately NOT the `documents` table. That one is a pipeline: a receipt
-- arrives, gets read, gets approved, becomes a job cost. A 113-page roles
-- manual has no business entering that queue.
--
-- These are records a business keeps and occasionally has to produce:
-- insurance certificates, licenses, W-9s, warranties, safety manuals,
-- subcontractor agreements.
--
-- The field that earns this table its place is `expires_on`. A contractor's
-- general liability certificate and license both expire, and letting one
-- lapse can stop a job or void a claim. Nobody has a system that tells them;
-- they find out when a GC asks for a current certificate.
-- ============================================================================

create table if not exists business_files (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id) on delete cascade,

  name          text not null,
  description   text,

  category      text not null default 'other'
                  check (category in (
                    'insurance','license','certification','contract','tax',
                    'manual','warranty','safety','other'
                  )),

  storage_path  text not null,
  file_name     text not null,
  mime_type     text,
  size_bytes    bigint,

  -- The point of the whole table.
  expires_on    date,
  -- Some records matter to everyone, some are internal.
  shared_with_client boolean not null default false,

  uploaded_by   uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists business_files_updated_at on business_files;
create trigger business_files_updated_at before update on business_files
  for each row execute function set_updated_at();

create index if not exists business_files_org_idx on business_files(org_id);
create index if not exists business_files_expiring_idx
  on business_files(org_id, expires_on) where expires_on is not null;

comment on column business_files.expires_on is
  'Insurance and licenses lapse. This is what lets the app warn before a GC asks.';

alter table business_files enable row level security;

drop policy if exists business_files_org_wall on business_files;
create policy business_files_org_wall on business_files
  for all to authenticated
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

-- An agency managing a client's site can see records the client chose to
-- share — a certificate of insurance often has to go on a website or into a
-- bid package.
drop policy if exists business_files_shared_read on business_files;
create policy business_files_shared_read on business_files
  for select to authenticated
  using (
    shared_with_client
    and exists (
      select 1 from client_sites s
      where s.org_id = business_files.org_id
        and s.managed_by_org_id = current_org_id()
    )
  );
