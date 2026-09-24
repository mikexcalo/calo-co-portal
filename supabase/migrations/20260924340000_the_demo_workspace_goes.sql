-- The Demo workspace, removed on request.
--
-- What it held, for the record, because this does not come back:
--   7 customers  Foldwork, Harbor & Vine, Kettle & Co, Marrow Bakery,
--                Northbound Cycles, Pellet & Ash, Tilde Health (all "(Demo)")
--   3 jobs
--   1 membership (Mike's)
--
-- It was a fourth name in a switcher of five, on an account with three real
-- clients. Its job was to have something to look at before there was anything
-- real, and there is now. Marcie's workspace is the seeded one if a
-- walkthrough is ever needed again, and that one belongs to somebody.
--
-- Deleting the org cascades to everything under it.

delete from public.orgs where slug = 'demo' and is_demo = true;
