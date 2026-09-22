-- ============================================================================
-- WHAT IS THIS, AND WHAT DOES IT MEAN
-- ============================================================================
-- Two levels of overview, because there are two moments where somebody opens
-- something and does not know what they are looking at.
--
-- ABOVE EVERY DOCUMENT
--
-- A 30,000 character business plan and a 7,000 character answer sheet look
-- identical in a list. What is missing is the sentence that says which one is
-- which, and the sentence after it that says why you would open it.
--
-- Two fields rather than one, because they serve different people. `summary`
-- is what the document is, and the client would recognize their own document
-- from it. `takeaway` is what it means for the work, which is yours and
-- occasionally something you would not say to them.
--
-- ABOVE EVERYTHING
--
-- The brief. One standing paragraph per client that says who they are, what we
-- are doing, where it has got to and what is stuck. It is the thing every good
-- agency keeps and never calls the same thing twice: the one place that always
-- says where we are, so nobody has to reconstruct it from a timeline.
-- ============================================================================

alter table public.brand_intel
  add column if not exists summary text;

comment on column public.brand_intel.summary is
  'What this document is, in a sentence the client would recognize as theirs.';

alter table public.brand_intel
  add column if not exists takeaway text;

comment on column public.brand_intel.takeaway is
  'What it means for the work. Yours rather than theirs, and occasionally something you would not say to them.';

-- ---------------------------------------------------------------------------
-- The brief.
--
-- Named fields rather than free text, for the same reason the framework uses
-- them: the shape is the useful part, and a blank section is then a visible
-- gap rather than something somebody quietly left out.
--
-- On the client rather than in its own table because there is exactly one per
-- client, forever, and it supersedes itself rather than accumulating.
-- ---------------------------------------------------------------------------

alter table public.customers
  add column if not exists brief jsonb not null default '{}'::jsonb;

comment on column public.customers.brief is
  'who / doing / where / stuck. The standing answer to "where are we with these people", superseded in place rather than appended to.';

alter table public.customers
  add column if not exists brief_updated_at timestamptz;

/**
 * Stamped automatically.
 *
 * A brief nobody has touched in four months is worse than no brief, because it
 * reads as current. The date is the only thing that makes staleness visible,
 * and asking somebody to update a date by hand is asking them to maintain a
 * second record of something they just did.
 */
create or replace function public.stamp_brief()
returns trigger language plpgsql as $function$
begin
  if new.brief is distinct from old.brief then
    new.brief_updated_at := now();
  end if;
  return new;
end;
$function$;

drop trigger if exists customers_stamp_brief on public.customers;
create trigger customers_stamp_brief
  before update on public.customers
  for each row execute function public.stamp_brief();
