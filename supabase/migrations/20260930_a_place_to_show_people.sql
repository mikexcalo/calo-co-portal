-- ============================================================================
-- SOMEWHERE TO SHOW PEOPLE, THAT IS NOT YOUR BUSINESS
-- ============================================================================
-- Demonstrating this to a prospect currently means opening the real thing:
-- real clients, real invoice numbers, real amounts owed. That is a bad idea on
-- two counts. It shows a stranger what other people are paying, and an empty
-- month looks like a broken product rather than a quiet month.
--
-- So: another org. Not a mode, not a flag on the screens, not a fixture file.
-- Tenancy already goes through current_org_id(), so a demo org is isolated by
-- exactly the mechanism that isolates one client's business from another's.
-- Nothing new has to be trusted.
--
-- WHY IT IS MARKED
--
-- The one real risk with a demo is forgetting you are in it: typing a genuine
-- invoice into the fake business, or quoting fake numbers at a real client.
-- `is_demo` exists so the interface can say so, loudly and always.
-- ============================================================================

alter table public.orgs
  add column if not exists is_demo boolean not null default false;

comment on column public.orgs.is_demo is
  'Sample data for showing people. Marked so the interface can say so on every screen: the failure mode of a demo is forgetting you are in one.';

-- ---------------------------------------------------------------------------
-- The org itself.
--
-- Agency-kind, because that is what is being sold. A contractor demo is the
-- same seed with different vocabulary, and vocabFor() already handles that.
-- ---------------------------------------------------------------------------

insert into public.orgs (name, slug, kind, is_demo, plan, default_labor_rate, tax_rate, billing_style, onboarded_at)
select 'Northsea Studio', 'demo-northsea', 'agency', true, 'agency', 150, 0, 'retainer', now()
where not exists (select 1 from public.orgs where slug = 'demo-northsea');

/**
 * Everyone who can already see CALO&CO can see the demo.
 *
 * Membership rather than a special case in the policy. A demo you reach by
 * an exception in current_org_id() is a hole in the only wall this system
 * has; a demo you reach because you are a member of it is just another org.
 */
insert into public.memberships (user_id, org_id, role)
select m.user_id, d.id, 'owner'
  from public.memberships m
  cross join (select id from public.orgs where slug = 'demo-northsea') d
 where m.org_id = (select id from public.orgs where slug = 'calo-co' or name = 'CALO&CO' limit 1)
   and not exists (
     select 1 from public.memberships x
      where x.user_id = m.user_id and x.org_id = d.id
   );
