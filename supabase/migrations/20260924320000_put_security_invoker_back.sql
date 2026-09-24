-- I took security_invoker off customer_summary twenty minutes ago and did not
-- notice.
--
-- The migration that added linked_org_id to the view used CREATE OR REPLACE
-- VIEW, which rebuilds the view and drops its options. The original had
-- security_invoker = true. Without it a view runs as its owner, so every
-- row-level policy on customers is bypassed for anybody who reads it.
--
-- Verified by querying it as John: he could see all eighteen customers across
-- every workspace — Mammoth's clients, Marcie's, the demo set. He reaches
-- customer_summary through the workspace switcher on every page load.
--
-- Found by the same audit pass that was looking for exactly this, which is
-- the only reason it was a twenty minute window and not a permanent one.
--
-- access_by_day never had it either. Same fix, same reason.

alter view public.customer_summary set (security_invoker = true);
alter view public.access_by_day    set (security_invoker = true);
