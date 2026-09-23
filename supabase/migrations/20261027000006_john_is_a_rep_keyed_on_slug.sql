-- ============================================================================
-- Set John's workspace to rep, keyed on the slug this time.
--
-- 20261027000003 added the kind and then ran:
--
--   update public.orgs set kind = 'rep' where name = 'Global Seafood Partners';
--
-- The constraint landed and the update did not: the switcher still reads
-- Contractor, and his sidebar still carries Price List and Receipts, neither
-- of which is in the rep module set. A display name is typed by a person and
-- can carry trailing space, a different apostrophe, or a later rename. The
-- slug is generated once and never changes, which is why it exists.
--
-- Reports what it did rather than succeeding silently, because a no-op update
-- is exactly the failure being fixed here.
-- ============================================================================

do $$
declare
  n int;
  was text;
begin
  select kind into was from public.orgs where slug = 'global-seafood';

  if was is null then
    raise exception 'No org with slug global-seafood. Check the slug.';
  end if;

  update public.orgs set kind = 'rep' where slug = 'global-seafood';
  get diagnostics n = row_count;

  raise notice 'Global Seafood: was %, now rep. % row(s).', was, n;
end $$;

-- The kind chooses the modules, and orgs.modules can override any of them.
-- If anything was switched on by hand while it was filed as a contractor, it
-- stays on, which is the point of the override. Nothing here touches it.
