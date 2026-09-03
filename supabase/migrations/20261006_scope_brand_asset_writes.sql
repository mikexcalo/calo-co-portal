-- ============================================================================
-- WRITES TO brand-assets ARE NOW SCOPED TO THE ORG THAT OWNS THE FOLDER
-- ============================================================================
-- Yesterday's fix stopped anonymous writes, which was the emergency. It left
-- every signed-in person able to overwrite or delete any folder in the bucket,
-- including another workspace's marks. Two orgs exist and both are the
-- owner's, so nothing has been at risk yet; that stops being true the first
-- time somebody outside gets a login.
--
-- READS STAY PUBLIC, AND THAT IS A DECISION
--
-- A logo has to render in an img tag with no session, which is what a public
-- bucket is for. So everything in here is world-readable by URL to anybody who
-- knows it. That is fine for a mark already printed on a van and wrong for an
-- unreleased identity, and the honest rule is: brand-assets is for things you
-- would not mind a stranger seeing. Work in progress belongs in client-assets,
-- which is private and now scoped per org.
--
-- MAPPING A FOLDER TO AN ORG
--
-- Four top-level folders exist. One is a brand with asset_prefix set. Two are
-- pictures of people. One belongs to a client with no brand record at all, so
-- nobody can claim it and it becomes read-only, which is the correct answer
-- for an orphan rather than leaving it writable by everyone.
-- ============================================================================

create or replace function public.brand_asset_org(path text)
returns uuid
language sql
stable
security definer
set search_path = public
as $function$
  select b.org_id
    from public.brands b
   where b.asset_prefix is not null
     and split_part(path, '/', 1) = b.asset_prefix
   limit 1;
$function$;

comment on function public.brand_asset_org is
  'The org owning a brand-assets folder, via brands.asset_prefix. Null for folders nobody claims, which makes them read-only.';

drop policy if exists brand_assets_signed_in_write  on storage.objects;
drop policy if exists brand_assets_signed_in_update on storage.objects;
drop policy if exists brand_assets_signed_in_delete on storage.objects;

/**
 * Pictures of people are not brand assets.
 *
 * avatars/ and headshots/ hold faces, belong to no brand, and are written when
 * somebody sets their own picture. Any signed-in person may write there.
 * Narrowing to the individual would need the path to carry a user id, which is
 * a rename of existing files rather than a policy change.
 */
create policy brand_assets_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'brand-assets'
    and (
      public.brand_asset_org(name) = public.current_org_id()
      or split_part(name, '/', 1) in ('avatars', 'headshots')
    )
  );

create policy brand_assets_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'brand-assets'
    and (
      public.brand_asset_org(name) = public.current_org_id()
      or split_part(name, '/', 1) in ('avatars', 'headshots')
    )
  )
  with check (
    bucket_id = 'brand-assets'
    and (
      public.brand_asset_org(name) = public.current_org_id()
      or split_part(name, '/', 1) in ('avatars', 'headshots')
    )
  );

create policy brand_assets_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'brand-assets'
    and public.brand_asset_org(name) = public.current_org_id()
  );
