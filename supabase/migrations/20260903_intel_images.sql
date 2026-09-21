-- ============================================================================
-- INTEL THAT IS NOT TEXT
-- ============================================================================
-- A photographed page of handwriting is the most common way this work actually
-- arrives. Somebody sat in a meeting with a notebook, and asking them to type
-- it up before the system will accept it is asking them to do the work twice.
-- The second time is the one that never happens.
--
-- Whiteboards, screenshots of a competitor's page, and a founder's scrawled
-- positioning attempt all land the same way.
-- ============================================================================

alter table public.brand_intel
  add column if not exists image_path text;

comment on column public.brand_intel.image_path is
  'Private storage path for a photographed or screenshotted drop. The file is kept as well as read, because a proposal is only checkable against the original.';

-- ---------------------------------------------------------------------------
-- A drop has to be one or the other.
--
-- Without this, a failed upload leaves a row that is neither text nor image:
-- it lists on the screen, reads as something you have, and contains nothing.
-- An empty record of a conversation is worse than no record, because it stops
-- you going to look for the real one.
-- ---------------------------------------------------------------------------

alter table public.brand_intel
  alter column body set default '';

alter table public.brand_intel drop constraint if exists brand_intel_has_something;
alter table public.brand_intel add constraint brand_intel_has_something
  check (length(btrim(body)) > 0 or image_path is not null);

-- A photograph of a notebook page is its own kind of thing. Filing it as a
-- "note" would lose the one fact that changes how it is read.
alter table public.brand_intel drop constraint if exists brand_intel_kind_check;
alter table public.brand_intel add constraint brand_intel_kind_check
  check (kind in ('transcript', 'note', 'email', 'site', 'doc', 'image'));
