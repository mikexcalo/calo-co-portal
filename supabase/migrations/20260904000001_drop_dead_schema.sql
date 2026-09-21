-- ============================================================================
-- REMOVING THE SCHEMA NOBODY IS WATCHING
-- ============================================================================
-- Seventeen tables from an earlier build, sitting alongside the live ones and
-- holding the same concepts under different names: clients beside customers,
-- contacts beside customer_contacts, notes beside customer_notes, invoices
-- beside job_invoices.
--
-- Every one holds zero rows and is referenced by zero lines of application
-- code. Both facts were checked rather than assumed, and the column
-- definitions are recorded in 20260904_dropped_schema_record.sql so this is
-- reviewable after the fact.
--
-- WHY THIS IS A SECURITY FIX AND NOT HOUSEKEEPING
--
-- Four of these are where the audit found row level security switched off.
-- Three real people's names, emails and phone numbers came out of `clients`
-- and `contacts` over plain HTTP with no login, and `assets` was readable and
-- deletable by anonymous callers.
--
-- The lesson was not that a policy had been forgotten. It was that nobody
-- audits a table nobody remembers exists. A dead table is a permanently
-- unwatched door, and locking it only helps until the next migration adds a
-- policy to the wrong one. Removing the door is the fix that stays fixed.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- One live dependency, cleared first.
--
-- profiles.client_id points at the old clients table. It is null on every row
-- and no code reads it, so it is a leftover pointer rather than a feature.
-- Dropping it explicitly, rather than letting cascade take it silently, so the
-- one live table this touches is named out loud.
-- ---------------------------------------------------------------------------

alter table public.profiles drop column if exists client_id;

-- ---------------------------------------------------------------------------
-- The dead set.
--
-- cascade is doing one job here: removing foreign keys that point between
-- these tables. Nothing outside this list depends on any of them, which is why
-- the profiles column above had to go first.
-- ---------------------------------------------------------------------------

drop table if exists public._archived_client_tasks_notes cascade;
drop table if exists public.activity_log   cascade;
drop table if exists public.ingest_events  cascade;
drop table if exists public.ingest_log     cascade;
drop table if exists public.quote_requests cascade;
drop table if exists public.events         cascade;
drop table if exists public.tasks          cascade;
drop table if exists public.notes          cascade;
drop table if exists public.contacts       cascade;
drop table if exists public.invoices       cascade;
drop table if exists public.leads          cascade;
drop table if exists public.assets         cascade;
drop table if exists public.brand_kits     cascade;
drop table if exists public.sites          cascade;
drop table if exists public.clients        cascade;
drop table if exists public.agencies       cascade;
drop table if exists public.agency         cascade;
