-- ============================================================================
-- THE BRAND KIT FEEDS EVERY PLACE A LOGO IS SHOWN
-- ============================================================================
-- Mammoth's logos have been in storage the whole time, in folders that already
-- say what each one is: icon, favicon, color, dark, light, secondary. Asking
-- somebody to paste a logo URL onto the client record was asking them to
-- retype something the system already had, and to keep it in step by hand
-- forever after. Storing the kit is only worth it if the kit feeds things.
--
-- WHY A PREFIX COLUMN
--
-- The folders are named for ids that no longer exist anywhere in this schema:
-- they were written by an earlier brand builder that has since been replaced.
-- Rather than rename storage objects, which is a copy of every file and a
-- window where the assets are missing, the brand records where its own folder
-- is. One column, set once.
-- ============================================================================

alter table public.brands
  add column if not exists asset_prefix text;

comment on column public.brands.asset_prefix is
  'Folder inside the brand-assets bucket. Named for ids written by an earlier builder, so the brand points at its folder rather than the folder being renamed.';

-- Mammoth's, identified by the filenames inside it.
update public.brands
   set asset_prefix = 'f7e5c158-98bb-43a1-80e8-68b7c529f874'
 where name = 'Mammoth Construction'
   and asset_prefix is null;

/**
 * The best logo to show at small size, chosen rather than guessed.
 *
 * Ranking, in order of how much it matters:
 *
 *   Renderable at all. ai, eps and pdf are the print masters. A browser shows
 *   nothing for them, so they are excluded rather than ranked last.
 *
 *   svg over png, because this is drawn anywhere from 26 to 34 pixels and a
 *   raster mark at that size is mush.
 *
 *   A square mark over a full lockup. icon and favicon are the mark on its
 *   own, which is what fits beside a name in a list. A horizontal lockup with
 *   the company name set beside it becomes illegible in a 26px box.
 *
 *   Not the white variant. It is drawn to sit on a dark ground and disappears
 *   on the light one this interface uses, which is a bug that looks exactly
 *   like a missing image.
 *
 * SECURITY DEFINER because storage.objects is not readable through the normal
 * policies, and the org check is what makes that safe: without it, anybody
 * could pass another workspace's brand id and learn their filenames.
 */
create or replace function public.brand_logo_path(brand uuid)
returns text
language sql
stable
security definer
set search_path = public
as $function$
  select o.name
    from public.brands b
    join storage.objects o
      on o.bucket_id = 'brand-assets'
     and o.name like b.asset_prefix || '/%'
   where b.id = brand
     and b.org_id = public.current_org_id()
     and b.asset_prefix is not null
     and lower(o.name) ~ '\.(svg|png)$'
   order by
     case when lower(o.name) ~ '\.svg$' then 0 else 1 end,
     -- Ahead of folder preference, deliberately. Mammoth's icon folder holds
     -- a gold-and-white lockup: verified by reading the file, half its paths
     -- are fill:#fff, so on this light interface half the mammoth vanishes and
     -- it looks exactly like a broken image. The favicon is a single gold ink
     -- and is the better mark at 26px, so the ink has to outrank the folder.
     case when lower(o.name) like '%white%' then 1 else 0 end,
     case
       when o.name like '%/icon/%'      then 0
       when o.name like '%/favicon/%'   then 1
       when o.name like '%/color/%'     then 2
       when o.name like '%/secondary/%' then 3
       when o.name like '%/dark/%'      then 4
       else 5
     end,
     o.name
   limit 1;
$function$;

revoke all on function public.brand_logo_path(uuid) from public;
grant execute on function public.brand_logo_path(uuid) to authenticated;

comment on function public.brand_logo_path is
  'Best small-size logo for a brand, from the kit. Prefers svg, then the mark on its own over a full lockup, and never the white variant on a light interface.';

/**
 * What a client's logo actually is, in one place.
 *
 * An explicit logo_url on the client wins, because an override exists to be
 * obeyed. Everything else falls through to the kit, so a logo dropped into
 * the brand kit appears on the client list, the record and anywhere else that
 * reads this, without anybody copying a URL between two screens.
 */
create or replace function public.customer_logo_path(cust uuid)
returns text
language sql
stable
set search_path = public
as $function$
  select coalesce(
    (select nullif(trim(c.logo_url), '') from public.customers c where c.id = cust),
    (select public.brand_logo_path(b.id)
       from public.brands b
      where b.customer_id = cust
      order by b.created_at
      limit 1)
  );
$function$;

comment on function public.customer_logo_path is
  'The client mark: an explicit override first, then whatever the brand kit holds. One answer, so no screen has to decide for itself.';
