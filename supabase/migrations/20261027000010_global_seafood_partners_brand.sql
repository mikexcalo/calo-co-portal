/*
  Global Seafood Partners' brand, stored.

  The row already existed and held an empty shell: fonts [], colors [],
  assets []. Everything below comes from the approved direction; nothing is
  derived, inferred or tidied. status stays 'building', because it is.

  ONE BRAND, BY ID

  Keyed on the brand's uuid rather than its name. A name is a thing somebody
  edits on a Tuesday, and this writes a whole kit object over whatever is
  there, so it must not be able to land on the wrong row. The guard below
  refuses to run at all if that id is not Global Seafood Partners' brand in
  CALO&CO, which makes a copy-pasted id into another environment a loud
  failure rather than a quiet overwrite of somebody else's identity.

  WHY asset_prefix IS SET HERE

  client-assets is scoped by public.client_asset_org(path), which resolves a
  path to an org through either `intel/<brand id>/...` or `<asset_prefix>/...`.
  Without a prefix the second shape resolves to null, null matches no policy,
  and every read of the marks is denied. The three files are already at
  gsp/assets/icons/, so the prefix has to say 'gsp' for anybody to see them.

  kit.pairings IS NEW

  Three rules that are decisions rather than arithmetic. The contrast table on
  the brand page is computed from the colours and will tell you Wet slate on
  Buoy clears 3:1 for large text; it has no way of knowing somebody ruled that
  white on Buoy is never acceptable whatever the number says. Stored as the
  sentences as written, because a structured grammar of allowed pairs would
  have to be invented per brand and still could not express "never as text on".

  Any brand can carry pairings. This is the first that does.
*/

do $$
declare
  gsp_brand constant uuid := 'c3d27556-fb60-40db-83d7-cb263edbcb92';
  /* Not called `found`: that is PL/pgSQL's own boolean, and shadowing it makes
     `if not found` a type error rather than the guard it looks like. */
  target    record;
begin
  select b.id, b.name, o.name as org, b.status
    into target
    from public.brands b
    join public.orgs o on o.id = b.org_id
   where b.id = gsp_brand;

  if target.id is null then
    raise exception 'Brand % not found. Refusing to write a kit to nothing.', gsp_brand;
  end if;

  if target.name <> 'Global Seafood Partners' or target.org <> 'CALO&CO' then
    raise exception
      'Brand % is "%" in "%", not Global Seafood Partners in CALO&CO. Refusing to overwrite it.',
      gsp_brand, target.name, target.org;
  end if;

  update public.brands
     set asset_prefix = 'gsp',
         kit = jsonb_build_object(
           'fonts', jsonb_build_array(
             jsonb_build_object(
               'family', 'Archivo Narrow',
               'role',   'Display, headlines and wordmark',
               'weight', '500',
               'case',   'uppercase',
               'source', 'Google Fonts'
             )
           ),
           'colors', jsonb_build_array(
             jsonb_build_object('name','Wet slate','hex','#2A2A2A','role','Primary text and dark grounds','token','--wet-slate'),
             jsonb_build_object('name','White',    'hex','#FFFFFF','role','Primary ground',                'token','--white'),
             jsonb_build_object('name','Salt',     'hex','#F6F7F7','role','Secondary ground',              'token','--salt'),
             jsonb_build_object('name','Tide',     'hex','#0068C9','role','Primary accent',                'token','--tide'),
             jsonb_build_object('name','Buoy',     'hex','#FF5A2A','role','Signal accent',                 'token','--buoy')
           ),
           'pairings', jsonb_build_array(
             'Text on Buoy is always Wet slate, never white',
             'Buoy is never used as text on White or Salt',
             'Tide and Buoy never carry text on each other'
           ),
           /*
             storage_path is relative to asset_prefix, which is how Colette's
             have always been stored and what the brand page prepends before
             signing. The files are already in the bucket, byte for byte,
             checksums verified against the originals after upload.
           */
           'assets', jsonb_build_array(
             jsonb_build_object(
               'name','gsp-mark-slate-on-white.svg',
               'path','assets/icons/gsp-mark-slate-on-white.svg',
               'storage_path','assets/icons/gsp-mark-slate-on-white.svg',
               'group','Master',
               'for','Primary. Slate mark on white',
               'bytes', 21344,
               'needs_approval', false
             ),
             jsonb_build_object(
               'name','gsp-mark-white-on-slate.svg',
               'path','assets/icons/gsp-mark-white-on-slate.svg',
               'storage_path','assets/icons/gsp-mark-white-on-slate.svg',
               'group','Master',
               'for','Reversed. White mark on slate',
               'bytes', 21344,
               'needs_approval', false
             ),
             jsonb_build_object(
               'name','gsp-mark-tide.svg',
               'path','assets/icons/gsp-mark-tide.svg',
               'storage_path','assets/icons/gsp-mark-tide.svg',
               'group','Master',
               'for','Accent. Tide mark on white',
               'bytes', 21344,
               'needs_approval', false
             )
           )
         ),
         updated_at = now()
   where id = gsp_brand;

  raise notice 'Global Seafood Partners brand written. status left as %.', target.status;
end
$$;
