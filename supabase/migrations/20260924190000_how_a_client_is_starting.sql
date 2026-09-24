-- Three people arrived in the same week needing three different amounts of
-- this platform, and all three got the same one.
--
-- Everything needed to tailor a workspace already existed: orgs.modules holds
-- a per-module state, /what-you-see edits it, and three business kinds each
-- carry their own default list. What was missing is the field that records
-- WHAT A CLIENT IS TO YOU, so the tailoring could be one choice instead of
-- fourteen switches flipped correctly from memory, per client.
--
-- Not their role inside their own business, which is what /welcome already
-- asks and is a different question. This is the relationship.

alter table public.orgs
  add column if not exists onboarding_path text
    check (onboarding_path in ('looking', 'one_thing', 'whole'));

comment on column public.orgs.onboarding_path is
  'How this workspace is starting: looking (a tester), one_thing (a narrow '
  'real use), whole (built end to end). Drives the module preset. Null means '
  'nobody has chosen, and the business kind decides on its own.';

-- The three on file, from what is already true of them.
--   Lakemere  — Marcie, looking on her husband's behalf.
--   Mammoth   — Mark, one narrow slice: the proposal and the invoices.
--   Global Seafood — John, being built end to end.
update public.orgs set onboarding_path = 'looking'   where slug = 'lakemere'       and onboarding_path is null;
update public.orgs set onboarding_path = 'one_thing' where slug = 'mammoth'        and onboarding_path is null;
update public.orgs set onboarding_path = 'whole'     where slug = 'global-seafood' and onboarding_path is null;
