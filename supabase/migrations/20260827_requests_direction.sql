-- ============================================================================
-- SITE REQUESTS: FIX THE DIRECTION
-- ============================================================================
-- The first cut had this backwards. It treated site requests as something a
-- business RECEIVES, which made Mammoth's portal look like Mammoth runs a web
-- agency. Mammoth pours concrete.
--
-- The real shape:
--
--   Mammoth (client)  --submits a request-->  CALO&CO (agency)  --builds it-->
--
-- So a site has an OWNER (the client whose site it is) and a MANAGER (the
-- agency that maintains it). A request is visible to both: the client sees
-- their own, and the agency sees every request across every site it manages.
--
-- That cross-org visibility is the whole point of a platform admin, and it is
-- the one place the strict per-org wall has to open — carefully, in one
-- direction only.
-- ============================================================================

alter table client_sites
  add column if not exists managed_by_org_id uuid references orgs(id) on delete set null;

create index if not exists client_sites_managed_by_idx on client_sites(managed_by_org_id);

comment on column client_sites.managed_by_org_id is
  'The agency that maintains this site. Requests for it are visible to that org.';

-- ---------------------------------------------------------------------------
-- Does the caller's active org manage this site?
-- Security definer so it can see across the org wall — this is the ONLY
-- function permitted to, and it answers a yes/no question rather than
-- returning data.
-- ---------------------------------------------------------------------------

create or replace function current_org_manages_site(site uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from client_sites s
    where s.id = site
      and s.managed_by_org_id is not null
      and s.managed_by_org_id = current_org_id()
  )
$$;

-- ---------------------------------------------------------------------------
-- Sites: yours, or ones you manage
-- ---------------------------------------------------------------------------

drop policy if exists client_sites_org_wall on client_sites;

drop policy if exists client_sites_visible on client_sites;
create policy client_sites_visible on client_sites
  for select to authenticated
  using (org_id = current_org_id() or managed_by_org_id = current_org_id());

-- Only the managing agency edits a site record. A client changing their own
-- repo pointer would be a foot-gun with no upside.
drop policy if exists client_sites_manage on client_sites;
create policy client_sites_manage on client_sites
  for all to authenticated
  using (managed_by_org_id = current_org_id())
  with check (managed_by_org_id = current_org_id());

-- ---------------------------------------------------------------------------
-- Requests: submit your own, and the agency sees everything it manages
-- ---------------------------------------------------------------------------

drop policy if exists site_requests_org_wall on site_requests;

drop policy if exists site_requests_visible on site_requests;
create policy site_requests_visible on site_requests
  for select to authenticated
  using (
    org_id = current_org_id()
    or (site_id is not null and current_org_manages_site(site_id))
  );

-- A client may raise a request against a site they own.
drop policy if exists site_requests_submit on site_requests;
create policy site_requests_submit on site_requests
  for insert to authenticated
  with check (org_id = current_org_id());

-- Only the managing agency decides what happens to it. A client editing the
-- approved brief, or marking their own request shipped, would make the queue
-- meaningless.
drop policy if exists site_requests_triage on site_requests;
create policy site_requests_triage on site_requests
  for update to authenticated
  using (site_id is not null and current_org_manages_site(site_id))
  with check (site_id is not null and current_org_manages_site(site_id));

-- ---------------------------------------------------------------------------
-- Editable content: the client edits their own; the agency defines the fields
-- ---------------------------------------------------------------------------

drop policy if exists site_content_org_wall on site_content;

drop policy if exists site_content_visible on site_content;
create policy site_content_visible on site_content
  for select to authenticated
  using (org_id = current_org_id() or current_org_manages_site(site_id));

drop policy if exists site_content_client_edit on site_content;
create policy site_content_client_edit on site_content
  for update to authenticated
  using (org_id = current_org_id() or current_org_manages_site(site_id))
  with check (org_id = current_org_id() or current_org_manages_site(site_id));

drop policy if exists site_content_agency_define on site_content;
create policy site_content_agency_define on site_content
  for insert to authenticated
  with check (current_org_manages_site(site_id));

drop policy if exists site_content_agency_delete on site_content;
create policy site_content_agency_delete on site_content
  for delete to authenticated
  using (current_org_manages_site(site_id));

-- ---------------------------------------------------------------------------
-- Which modules a business sees.
--
-- Mammoth should not have a Brand Kit or a client-request inbox — they pour
-- concrete. CALO&CO should have everything. Stored per org so enabling a
-- module for a client later is a flag, not a deploy.
-- ---------------------------------------------------------------------------

alter table orgs
  add column if not exists modules jsonb not null default '{}'::jsonb;

comment on column orgs.modules is
  'Per-business module flags. Empty means use the defaults for orgs.kind.';
