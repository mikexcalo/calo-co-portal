-- ============================================================================
-- ANYBODY ON THE INTERNET COULD DELETE EVERY BRAND ASSET
-- ============================================================================
-- storage had one policy on brand-assets:
--
--   portal_all_access · FOR ALL · TO anon · USING (bucket_id = 'brand-assets')
--
-- FOR ALL is select, insert, update AND delete. TO anon is the role every
-- browser gets before anybody signs in, and the key that assumes it is
-- NEXT_PUBLIC_SUPABASE_ANON_KEY, which ships inside the JavaScript bundle by
-- design. So the logo set for every client, and the headshots, could be
-- overwritten or deleted by anyone who opened dev tools.
--
-- Reading was never the problem. The bucket is deliberately public, which is
-- what makes a logo renderable in an img tag without a signed URL. Writing is
-- the problem, and writing was granted to the same role.
--
-- Fixed by splitting the one policy in two: anon reads, signed-in people
-- write. Narrowing within the bucket by org is a separate piece of work,
-- noted at the bottom, because the folder names predate this schema and
-- cannot be mapped to an org without moving files.
-- ============================================================================

drop policy if exists portal_all_access on storage.objects;

create policy brand_assets_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'brand-assets');

create policy brand_assets_signed_in_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'brand-assets');

create policy brand_assets_signed_in_update on storage.objects
  for update to authenticated
  using (bucket_id = 'brand-assets')
  with check (bucket_id = 'brand-assets');

create policy brand_assets_signed_in_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'brand-assets');

-- ============================================================================
-- client-assets HAD NO POLICIES, SO EVERY UPLOAD SILENTLY FAILED
-- ============================================================================
-- Row level security with no policy denies everything. lib/spine/intel.ts
-- uploads dropped images there with the signed-in user's session, and returns
-- null on error without surfacing it, so the feature has been dead the whole
-- time and said nothing. Four intel drops exist and not one has an image.
--
-- The brand export reads the same bucket with the caller's session too, so an
-- exported kit has been shipping without its assets.
--
-- Scoped properly rather than thrown open, because this bucket holds one
-- client's website build and another client must not read it.
-- ============================================================================

/**
 * Which org owns a path in client-assets.
 *
 * Two shapes exist. `intel/<brand id>/...` written by the drop box, and
 * `<brand prefix>/...` written by the earlier builder. Both resolve through
 * brands, which is the thing that actually carries an org.
 *
 * Returns null for anything unrecognized, and a null org matches no policy,
 * so an unknown path shape is denied rather than shared.
 */
create or replace function public.client_asset_org(path text)
returns uuid
language sql
stable
security definer
set search_path = public
as $function$
  select b.org_id
    from public.brands b
   where (
           -- intel/<brand id>/...
           split_part(path, '/', 1) = 'intel'
           and split_part(path, '/', 2) ~ '^[0-9a-f-]{36}$'
           and b.id = split_part(path, '/', 2)::uuid
         )
      or (
           -- <brand prefix>/...
           b.asset_prefix is not null
           and split_part(path, '/', 1) = b.asset_prefix
         )
   limit 1;
$function$;

comment on function public.client_asset_org is
  'The org owning a client-assets path. Null for an unrecognized shape, which denies rather than shares.';

-- Colette's website build sits under its own folder, written before this
-- schema existed. Naming the prefix is what lets one rule cover both shapes.
update public.brands set asset_prefix = 'colette'
 where name = 'Colette Intelligence' and asset_prefix is null;

create policy client_assets_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'client-assets'
    and public.client_asset_org(name) = public.current_org_id()
  );

create policy client_assets_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'client-assets'
    and public.client_asset_org(name) = public.current_org_id()
  );

create policy client_assets_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'client-assets'
    and public.client_asset_org(name) = public.current_org_id()
  );

-- ============================================================================
-- A DEAD FUNCTION THAT MINTED LIVE API KEYS
-- ============================================================================
-- create_test_site was SECURITY DEFINER with no pinned search_path, generated
-- credentials prefixed hk_live_, and inserted into a `sites` table that does
-- not exist in this schema. Left over from an earlier application.
--
-- An unpinned search_path on a definer function is the standard privilege
-- escalation route: anything it calls unqualified can be shadowed by an object
-- in a schema earlier in the path, and the shadowed version then runs as the
-- function's owner. It cannot succeed here because the table is gone, but a
-- credential minter nobody calls is not something to leave loaded.
-- ============================================================================

drop function if exists public.create_test_site(text, uuid, uuid);

-- ============================================================================
-- DUPLICATE POLICIES ON profiles
-- ============================================================================
-- Two selects and two updates saying the same thing, from two migrations that
-- each added their own. Harmless today and exactly how a policy gets "fixed"
-- in one copy later while the other keeps granting.
-- ============================================================================

drop policy if exists "view own profile" on public.profiles;
drop policy if exists "update own profile" on public.profiles;
drop policy if exists "insert own profile" on public.profiles;

-- Left deliberately: brand-assets is not scoped by org inside the bucket. Its
-- folders are named for ids that predate this schema, so scoping needs the
-- files moved under an org prefix. Two orgs exist today and both are the
-- owner's, so the exposure is one signed-in agency reading another's marks:
-- worth fixing before the first outside workspace, not tonight.
