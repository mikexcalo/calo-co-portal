-- ============================================================================
-- SOMEWHERE TO PUT THINGS
-- ============================================================================
-- The app could take a receipt and a price list and nothing else. Everything
-- a business actually knows about its customers — the spreadsheet of contacts,
-- the notes from a call, the six links you keep open in a browser tab because
-- there is nowhere else for them — had no home, so it stayed in the browser
-- tab and the shoebox.
--
-- Three additions, all of them places to put something you already have.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Links.
--
-- The specific complaint: "links that pertain to a client that I don't want
-- as open tabs in Chrome". A tab is a filing system that loses everything on
-- restart, and the reason people use it is that opening a bookmark manager
-- and finding the right folder is slower than just not closing the tab.
--
-- So a link belongs beside the customer it is about. Attached to nobody, it
-- is still useful — a supplier, a permit portal, an insurance login.
-- ---------------------------------------------------------------------------

create table if not exists public.links (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  customer_id uuid references customers(id) on delete cascade,
  job_id      uuid references jobs(id) on delete cascade,
  url         text not null,
  title       text,
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists links_org_idx      on public.links(org_id);
create index if not exists links_customer_idx on public.links(customer_id) where customer_id is not null;

alter table public.links enable row level security;

drop policy if exists links_own on public.links;
create policy links_own on public.links
  for all to authenticated
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

comment on table public.links is
  'Bookmarks that belong to a customer or a job rather than to a browser window.';

-- ---------------------------------------------------------------------------
-- Notes and transcripts.
--
-- customer_notes already existed but only ever held a line typed by hand.
-- A call transcript or a page of scribbled notes is the same thing arriving
-- in bulk, so it goes in the same place — with a record of where it came from,
-- because a note somebody wrote and a note a model summarized deserve
-- different amounts of trust, and six months later nobody remembers which is
-- which.
-- ---------------------------------------------------------------------------

alter table public.customer_notes add column if not exists source text
  check (source in ('typed', 'transcript', 'imported', 'extracted'));
update public.customer_notes set source = 'typed' where source is null;
alter table public.customer_notes alter column source set default 'typed';

alter table public.customer_notes add column if not exists title text;

comment on column public.customer_notes.source is
  'Where this came from. A line someone typed and a summary a model produced are not equally trustworthy, and in six months nobody will remember which was which.';

-- ---------------------------------------------------------------------------
-- Import batches.
--
-- A spreadsheet of two hundred contacts is one decision, not two hundred. If
-- it turns out the columns were mapped wrong, the fix has to be "undo that
-- import" — which is impossible unless the rows remember they arrived
-- together.
-- ---------------------------------------------------------------------------

create table if not exists public.import_batches (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references orgs(id) on delete cascade,
  kind         text not null,
  source_name  text,
  row_count    integer not null default 0,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  undone_at    timestamptz
);

alter table public.import_batches enable row level security;

drop policy if exists import_batches_own on public.import_batches;
create policy import_batches_own on public.import_batches
  for all to authenticated
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

alter table public.customers add column if not exists import_batch_id uuid
  references import_batches(id) on delete set null;

create index if not exists customers_batch_idx on public.customers(import_batch_id)
  where import_batch_id is not null;

comment on table public.import_batches is
  'One spreadsheet, one decision. Rows remember they arrived together so a bad import can be undone as a unit rather than row by row.';
