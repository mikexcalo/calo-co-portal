-- ============================================================================
-- SCHEMA SNAPSHOT — public schema as it existed on 2026-08-21
-- ============================================================================
-- Captured from the live database BEFORE the Nautilus spine migration ran.
--
-- WHY THIS FILE EXISTS: most of these tables (clients, invoices, quotes,
-- expenses, brand_kits...) were created by hand in the Supabase dashboard and
-- had NO migration file. If the project had been deleted rather than paused
-- during the July outage, their structure would have been unrecoverable.
--
-- This is a REFERENCE snapshot, not a runnable migration: it records columns,
-- types, nullability and defaults, but not constraints, indexes, RLS policies
-- or foreign keys.
-- ============================================================================

-- _archived_client_tasks_notes (7 columns)
create table _archived_client_tasks_notes (
  id                           uuid default gen_random_uuid() not null,
  client_id                    uuid,
  type                         text default 'task'::text,
  content                      text,
  status                       text default 'open'::text,
  created_at                   timestamp with time zone default now(),
  completed_at                 timestamp with time zone
);

-- activity_log (5 columns)
create table activity_log (
  id                           uuid default gen_random_uuid() not null,
  client_id                    uuid,
  event_type                   text not null,
  metadata                     jsonb default '{}'::jsonb,
  created_at                   timestamp with time zone default now()
);

-- agencies (7 columns)
create table agencies (
  id                           uuid default gen_random_uuid() not null,
  name                         text not null,
  slug                         text not null,
  status                       text default 'active'::text not null,
  created_at                   timestamp with time zone default now() not null,
  updated_at                   timestamp with time zone default now() not null,
  metadata                     jsonb default '{}'::jsonb not null
);

-- agency (6 columns)
create table agency (
  id                           uuid default gen_random_uuid() not null,
  name                         text default 'CALO&CO'::text not null,
  founder                      text,
  url                          text,
  location                     text,
  created_at                   timestamp with time zone default now()
);

-- assets (7 columns)
create table assets (
  id                           uuid default gen_random_uuid() not null,
  brand_kit_id                 uuid,
  slot                         text not null,
  file_name                    text,
  storage_url                  text,
  is_primary                   boolean default false,
  created_at                   timestamp with time zone default now()
);

-- brand_kits (6 columns)
create table brand_kits (
  id                           uuid default gen_random_uuid() not null,
  client_id                    uuid,
  typography                   jsonb default '{}'::jsonb,
  color_palette                jsonb default '[]'::jsonb,
  brand_notes                  text,
  created_at                   timestamp with time zone default now()
);

-- clients (21 columns)
create table clients (
  id                           uuid default gen_random_uuid() not null,
  name                         text not null,
  company                      text,
  email                        text,
  phone                        text,
  address                      text,
  active_modules               ARRAY default ARRAY['invoices'::text],
  created_at                   timestamp with time zone default now(),
  tier                         text default 'basic'::text,
  health_status                text default 'active'::text,
  engagement_status            text default 'active'::text,
  next_step                    text,
  brand_builder_fields         jsonb default '{}'::jsonb,
  code                         text,
  address_line_1               text,
  address_line_2               text,
  city                         text,
  state                        text,
  postal_code                  text,
  website                      text,
  lifecycle_stage              text default 'active'::text not null
);

-- contacts (20 columns)
create table contacts (
  id                           uuid default gen_random_uuid() not null,
  client_id                    uuid,
  name                         text not null,
  role                         text,
  email                        text,
  phone                        text,
  is_primary_contact           boolean default false,
  created_at                   timestamp with time zone default now(),
  updated_at                   timestamp with time zone default now() not null,
  avatar_url                   text,
  kind                         text default 'network'::text not null,
  tags                         ARRAY default '{}'::text[] not null,
  is_billing_contact           boolean default false not null,
  context                      text,
  met_at_date                  date,
  met_at_location              text,
  links                        jsonb default '[]'::jsonb not null,
  custom_fields                jsonb default '{}'::jsonb not null,
  source                       text,
  unread                       boolean default true not null
);

-- events (10 columns)
create table events (
  id                           uuid default gen_random_uuid() not null,
  created_at                   timestamp with time zone default now() not null,
  updated_at                   timestamp with time zone default now() not null,
  client_id                    uuid,
  contact_id                   uuid,
  title                        text not null,
  event_date                   date not null,
  location                     text,
  description                  text,
  source_note_id               uuid
);

-- ingest_events (8 columns)
create table ingest_events (
  id                           uuid default gen_random_uuid() not null,
  client_id                    uuid,
  site_id                      uuid,
  type                         text not null,
  payload                      jsonb default '{}'::jsonb not null,
  processed_at                 timestamp with time zone,
  created_at                   timestamp with time zone default now() not null,
  agency_id                    uuid
);

-- ingest_log (14 columns)
create table ingest_log (
  id                           uuid default gen_random_uuid() not null,
  site_id                      uuid,
  client_id                    uuid,
  api_key_prefix               text,
  form_id                      text,
  status_code                  integer not null,
  error_code                   text,
  ip                           inet,
  user_agent                   text,
  origin                       text,
  record_type                  text,
  record_id                    uuid,
  received_at                  timestamp with time zone default now() not null,
  agency_id                    uuid
);

-- invoices (21 columns)
create table invoices (
  id                           uuid default gen_random_uuid() not null,
  client_id                    uuid,
  invoice_number               text not null,
  status                       text default 'unpaid'::text not null,
  issued_date                  date,
  due_date                     date,
  subtotal                     numeric,
  total                        numeric,
  internal_margin              numeric default 0,
  notes                        text,
  line_items                   jsonb,
  attachment_url               text,
  created_at                   timestamp with time zone default now(),
  project_name                 text,
  project_description          text,
  terms                        text,
  tax                          numeric default 0,
  shipping                     numeric default 0,
  paid_at                      timestamp with time zone,
  type                         text default 'service'::text,
  source_quote_id              uuid
);

-- leads (10 columns)
create table leads (
  id                           uuid default gen_random_uuid() not null,
  created_at                   timestamp with time zone default now() not null,
  name                         text not null,
  email                        text not null,
  company                      text,
  message                      text,
  status                       text default 'new'::text not null,
  source                       text default 'site'::text not null,
  promoted_contact_id          uuid,
  read_at                      timestamp with time zone
);

-- notes (10 columns)
create table notes (
  id                           uuid default gen_random_uuid() not null,
  created_at                   timestamp with time zone default now() not null,
  updated_at                   timestamp with time zone default now() not null,
  client_id                    uuid,
  contact_id                   uuid,
  content                      text not null,
  kind                         text default 'note'::text not null,
  pinned                       boolean default false not null,
  source_raw                   text,
  source_kind                  text
);

-- profiles (5 columns)
create table profiles (
  id                           uuid not null,
  full_name                    text,
  created_at                   timestamp with time zone default now(),
  role                         text default 'client'::text not null,
  client_id                    uuid
);

-- quote_requests (19 columns)
create table quote_requests (
  id                           uuid default gen_random_uuid() not null,
  client_id                    uuid,
  email                        text,
  name                         text,
  phone                        text,
  message                      text,
  status                       text default 'new'::text not null,
  created_at                   timestamp with time zone default now() not null,
  updated_at                   timestamp with time zone default now() not null,
  site_id                      uuid,
  form_id                      text,
  idempotency_key              text,
  utm                          jsonb default '{}'::jsonb,
  source_meta                  jsonb default '{}'::jsonb,
  raw_fields                   jsonb default '{}'::jsonb,
  project_type                 text,
  budget_range                 text,
  timeline                     text,
  agency_id                    uuid
);

-- sites (25 columns)
create table sites (
  id                           uuid default gen_random_uuid() not null,
  client_id                    uuid,
  name                         text not null,
  slug                         text not null,
  production_domain            text,
  allowed_origins              ARRAY default '{}'::text[] not null,
  api_key_prefix               text not null,
  api_key_hash                 text not null,
  api_key_last_rotated_at      timestamp with time zone,
  repo_provider                text,
  repo_owner                   text,
  repo_name                    text,
  repo_default_branch          text default 'main'::text,
  vercel_team_id               text,
  vercel_project_id            text,
  status                       text default 'active'::text not null,
  rate_limit_per_minute        integer default 10 not null,
  rate_limit_per_day           integer default 500 not null,
  form_configs                 jsonb default '{}'::jsonb not null,
  notification_config          jsonb default '{}'::jsonb not null,
  created_at                   timestamp with time zone default now() not null,
  updated_at                   timestamp with time zone default now() not null,
  created_by                   uuid,
  metadata                     jsonb default '{}'::jsonb not null,
  agency_id                    uuid
);

-- tasks (11 columns)
create table tasks (
  id                           uuid default gen_random_uuid() not null,
  created_at                   timestamp with time zone default now() not null,
  updated_at                   timestamp with time zone default now() not null,
  client_id                    uuid,
  contact_id                   uuid,
  event_id                     uuid,
  title                        text not null,
  due_date                     date,
  lead_days                    integer,
  completed_at                 timestamp with time zone,
  source_note_id               uuid
);
