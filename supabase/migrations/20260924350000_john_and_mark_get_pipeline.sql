-- Pipeline for John and Mark.
--
-- Both had targets set to 'off', which is what the onboarding presets did:
-- "Whole business" leaves the business kind to decide, and "Running one
-- thing" switches off everything that is not the proposal and the invoices.
-- John came out with it off because a rep's default list does not include it;
-- Mark because his path turned it off on purpose.
--
-- Asked for directly, so it goes on for both. The preset can still turn it
-- off again — that is what changing path means — which is worth knowing
-- before switching either of them to a different one.
update public.orgs
   set modules = coalesce(modules, '{}'::jsonb) || '{"targets": "live"}'::jsonb
 where slug in ('global-seafood', 'mammoth');
