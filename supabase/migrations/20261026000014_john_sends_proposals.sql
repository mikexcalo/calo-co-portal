-- The word on the document a client receives.
--
-- Two kinds of business was one too few. A contractor sends an estimate, an
-- agency sends a proposal, and John distributes seafood — his org is filed as
-- contractor because that is the closer of the two, and "Estimate" is not what
-- he sends. The kind of business gets this right most of the time and the
-- exception is not rare enough to live with.

update public.orgs
   set settings = coalesce(settings, '{}'::jsonb) || '{"estimate_word":"Proposal"}'::jsonb
 where name = 'Global Seafood Partners';

comment on column public.orgs.settings is
  'Per-business overrides. estimate_word replaces the word for what gets sent before an invoice — Estimate for a contractor, Proposal for an agency, whatever this business actually calls it.';
