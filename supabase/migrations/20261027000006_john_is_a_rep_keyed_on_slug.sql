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

-- ----------------------------------------------------------------------------
-- The constraint first, because it was never applied.
--
-- 20261027000003 added 'rep' to orgs_kind_check and then ran the update. It
-- has never run: setting kind = 'rep' fails with a check constraint violation,
-- which can only mean the constraint still reads (agency, contractor).
--
-- Which also explains the thing I misdiagnosed. I assumed the earlier update
-- matched no rows because it keyed on a display name, and went looking for
-- trailing whitespace. The real reason is that the file holding it was
-- overwritten before it was run — I reused one filename for four different
-- migrations across an afternoon.
--
-- Repeated here so this file stands on its own, and idempotent so it does not
-- matter if 000003 is ever run afterwards.
-- ----------------------------------------------------------------------------
alter table public.orgs drop constraint if exists orgs_kind_check;

alter table public.orgs
  add constraint orgs_kind_check
    check (kind in ('agency', 'contractor', 'rep'));

comment on column public.orgs.kind is
  'agency = sells its own time. contractor = does the work on site. rep = sells somebody else''s product for a commission. Chooses the module set, the vocabulary and the defaults, so it is the template a like-for-like business inherits.';

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
