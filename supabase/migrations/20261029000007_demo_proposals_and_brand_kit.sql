/*
  Two modules switched on for one demo workspace, so two screens can be
  looked at.

  The proposal preview and the brand kit's two dropdowns were rebuilt in the
  overlay and dropdown sweep and then could not be checked, because neither
  module is in the `core` plan and every demo workspace is on `core`. The
  screens exist and redirect to Home. Converted and type-checked is not the
  same as seen, and the gap was reported rather than papered over.

  Harbor Light only. Tideline, Ember & Ash and Blank Co keep their shapes,
  because a demo where every workspace has every module stops demonstrating
  that modules do anything. Config, not data: no job, invoice or customer is
  touched, and no real workspace is either.
*/
update public.orgs
   set modules = coalesce(modules, '{}'::jsonb)
                 || jsonb_build_object('proposals', 'live', 'brand_kit', 'live')
 where name = 'Harbor Light Roofing'
   and is_demo;
