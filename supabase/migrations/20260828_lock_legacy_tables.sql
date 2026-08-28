-- ============================================================================
-- CLOSE THE LEGACY TABLES
-- ============================================================================
-- Found by audit, not by report. Four tables from the old portal — clients,
-- contacts, notes, tasks — were created before row level security was the
-- house rule and never had it switched on.
--
-- That is not a theoretical gap. The anon key ships inside the live site's
-- JavaScript, because that is what it is for: it identifies the project, and
-- RLS is the thing that actually decides who may read what. With RLS off,
-- every row was world-readable to anyone who opened dev tools. Verified by
-- reading three real people's names, emails and phone numbers over plain HTTP
-- with no login.
--
-- RLS on with no policy denies everyone. The REVOKE is belt and braces: even
-- if someone later adds a permissive policy by accident, the roles the public
-- internet uses have no grant on these tables at all.
--
-- The data stays. These tables are being sunset, and dropping them during an
-- incident fix is how you discover afterwards that something still read from
-- them. Close the door first; empty the room later.
-- ============================================================================

alter table public.clients  enable row level security;
alter table public.contacts enable row level security;
alter table public.notes    enable row level security;
alter table public.tasks    enable row level security;

revoke all on public.clients, public.contacts, public.notes, public.tasks
  from anon, authenticated;

comment on table public.contacts is
  'LEGACY, locked. Superseded by customers. No policies — reachable only with the service role.';

-- ---------------------------------------------------------------------------
-- invoice-attachments was a public bucket.
--
-- Empty, and nothing in the codebase references it, so nothing leaked. But a
-- public bucket named for invoices is a loaded gun sitting on the table: the
-- first person to upload a signed contract to it would have published it, and
-- public buckets need no token — the URL is the whole authorization.
--
-- brand-assets stays public on purpose. Logos are meant to be hot-linked from
-- email signatures and QR codes.
-- ---------------------------------------------------------------------------

update storage.buckets set public = false where name = 'invoice-attachments';
