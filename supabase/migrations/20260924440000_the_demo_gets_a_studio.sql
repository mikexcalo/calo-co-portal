-- The demo account becomes a three-tier setup, the same shape as the real one.
--
-- Mike's arrangement is three things and nothing else:
--
--   1. an org of kind 'agency' that he owns          CALO&CO
--   2. an 'owner' membership in each client's org    what fills the switcher
--   3. a customers row in the agency, with           what ties the client
--      linked_org_id pointing at that org            record to the workspace
--
-- Copied exactly. No new mechanism, no new columns, no code.
--
-- Northwind Studio is the demo's CALO&CO. Two new client workspaces join
-- Harbor Light Roofing under it. Blank Co stays outside as the
-- brand-new-signup case, unlinked and empty, because a new signup is not
-- somebody's client.

set local search_path = public, extensions;

do $$
declare
  demo   uuid := '97bf0269-75ba-4565-b2e7-e6565f40c7b9';
  studio uuid := gen_random_uuid();
  hlr    uuid;
  sauce  uuid := gen_random_uuid();
  tech   uuid := gen_random_uuid();
begin
  select id into hlr from public.orgs where slug = 'harbor-light-demo';
  if exists (select 1 from public.orgs where slug = 'northwind-studio-demo') then
    raise notice 'already built'; return;
  end if;

  -- ── Tier one: the studio ───────────────────────────────────────────────
  insert into public.orgs (id, name, slug, kind, is_demo, default_labor_rate, onboarded_at)
  values (studio,'Northwind Studio','northwind-studio-demo','agency', true, 140.00, now());

  -- ── Tier two: the client workspaces ────────────────────────────────────
  -- Kind drives vocabulary, not what is switched on. A hot sauce brand and a
  -- startup are both 'contractor' because that is the generic "a business
  -- that sells something" template; what makes them different is modules.
  insert into public.orgs (id, name, slug, kind, is_demo, default_labor_rate, onboarding_path, onboarded_at)
  values (sauce,'Ember & Ash Hot Sauce','ember-ash-demo','contractor', true, 0, 'whole', now());

  insert into public.orgs (id, name, slug, kind, is_demo, default_labor_rate, onboarding_path, onboarded_at)
  values (tech,'Tideline','tideline-demo','contractor', true, 0, 'whole', now());

  -- ── The membership in each, which is what the switcher reads ───────────
  insert into public.memberships (user_id, org_id, role) values
    (demo, studio,'owner'),
    (demo, sauce, 'owner'),
    (demo, tech,  'owner');

  -- Land in the studio, the way Mike lands in CALO&CO.
  update public.profiles set active_org_id = studio where id = demo;

  -- ── Tier three: the client records that tie them together ──────────────
  insert into public.customers (org_id, name, contact_name, contact_title, email, phone, stage, relationship, linked_org_id, workspace_id, tags)
  values
    (studio,'Harbor Light Roofing','Dana Okonkwo','Owner','dana@example.com','(512) 555-0170','won','customer', hlr,   hlr,   array['service']),
    (studio,'Ember & Ash Hot Sauce','Sofia Marchetti','Founder','sofia@example.com','(512) 555-0181','won','customer', sauce, sauce, array['consumer','wholesale']),
    (studio,'Tideline','Wes Okafor','Founder and CEO','wes@example.com','(512) 555-0193','won','customer', tech,  tech,  array['startup']);

  insert into public.customer_contacts (org_id, customer_id, name, title, email, phone, is_primary)
  select studio, c.id, c.contact_name, c.contact_title, c.email, c.phone, true
    from public.customers c where c.org_id = studio;

  -- What the studio charges each of them, so the money screens are not empty.
  insert into public.customer_terms (org_id, customer_id, hourly_rate, standard_rate, monthly_fee, monthly_fee_for, platform_fee, bills_on, pay_by, billing_live, agreed_on)
  select studio, c.id, 140.00, 140.00, 60.00, 'Web hosting', 40.00, 1, 'ACH', true, current_date - 120
    from public.customers c where c.org_id = studio;

  raise notice 'studio %, sauce %, tech %', studio, sauce, tech;
end $$;
