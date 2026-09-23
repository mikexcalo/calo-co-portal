-- ============================================================================
-- A third kind of business, because two was one too few.
--
-- orgs.kind has been 'agency' or 'contractor' since the beginning, and
-- contractor is not a decision, it is the fallback: anything not an agency
-- lands there. So Global Seafood Partners — a sales agency that represents
-- seafood producers and is paid commission on what moves — reads "Contractor"
-- in the workspace switcher, beside a lawn care business and a construction
-- company.
--
-- That label is not cosmetic. kind chooses the module set, the vocabulary and
-- the defaults, which makes it the template every like-for-like business
-- inherits. Filed as a contractor, the next rep who signs up gets Route
-- planning and job costing and no catalog, and somebody has to unpick it by
-- hand every time.
--
--   agency      sells its own time and work. CALO&CO.
--   contractor  does the work on site. Mammoth, Lakemere.
--   rep         sells somebody else's product for a cut. Global Seafood.
--
-- A rep never takes title to anything. There is no job to cost, nowhere to
-- drive to, and no estimate — there is a line card, a list of buyers, and a
-- commission. That is a different product, not a contractor with the wrong
-- name on it.
-- ============================================================================

alter table public.orgs
  drop constraint if exists orgs_kind_check;

alter table public.orgs
  add constraint orgs_kind_check
    check (kind in ('agency', 'contractor', 'rep'));

comment on column public.orgs.kind is
  'agency = sells its own time. contractor = does the work on site. rep = sells somebody else''s product for a commission. Chooses the module set, the vocabulary and the defaults, so it is the template a like-for-like business inherits.';

update public.orgs set kind = 'rep' where name = 'Global Seafood Partners';
