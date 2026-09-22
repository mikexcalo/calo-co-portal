-- ============================================================================
-- EVERY POLICY FILTERS ON org_id AND ELEVEN TABLES HAD NO INDEX ON IT
-- ============================================================================
-- Row level security is not a filter you can skip. Every select on these
-- tables carries `org_id = current_org_id()` whether the query mentions it or
-- not, so an unindexed org_id means a sequential scan on every read, forever,
-- by every screen.
--
-- Invisible today because the biggest table has a few dozen rows. site_events
-- is the one that makes it urgent: it is designed to take a row per visitor
-- per page per day, so it is the first table here that will reach millions,
-- and it shipped without the index its own policy depends on. That one is
-- mine, from this week.
--
-- CONCURRENTLY is deliberately not used. These tables are small enough that
-- the lock is measured in milliseconds, and a concurrent build cannot run
-- inside the transaction this migration executes in.
-- ============================================================================

create index if not exists brand_intel_org_idx        on public.brand_intel(org_id);
create index if not exists brand_proof_org_idx        on public.brand_proof(org_id);
create index if not exists case_study_claims_org_idx  on public.case_study_claims(org_id);
create index if not exists costs_org_idx              on public.costs(org_id);
create index if not exists customer_notes_org_idx     on public.customer_notes(org_id);
create index if not exists discovery_org_idx          on public.discovery(org_id);
create index if not exists estimates_org_idx          on public.estimates(org_id);
create index if not exists import_batches_org_idx     on public.import_batches(org_id);
create index if not exists site_content_org_idx       on public.site_content(org_id);
create index if not exists time_entries_org_idx       on public.time_entries(org_id);

-- The one that will actually get big, indexed the way it is read: an org's
-- events, newest first.
create index if not exists site_events_org_time_idx
  on public.site_events(org_id, created_at desc);
