/*
  Restores Harbor Light's settings, which I overwrote.

  Verifying that a sent proposal keeps its own word meant temporarily giving a
  demo workspace a distinctive one. I sent `{"settings": {"estimate_word":
  "Tender"}}` to PostgREST, which REPLACES the column rather than merging into
  it, so the four keys already in there went with it: the workspace colour, the
  phone and address that print on every document, and the licence number and
  deposit rule.

  The values below are the ones the seeds set, unchanged:

    workspace_color   20260925010000_harbor_light_gets_a_colour
    phone, address    20261028000002_demo_businesses_look_like_businesses
    license_no        20261028000006_licence_and_deposits
    deposit           20261028000006_licence_and_deposits

  Harbor Light has no `brand` key - its brand is a `brands` row, not settings -
  and no other migration writes to this column for it, so this is the whole of
  what was there.

  The lesson is the merge, not the test: a settings write is `settings ||
  jsonb`, never a bare object, because this column is shared by brand,
  workspace colour, signature, business details and the document word, and
  whoever writes one of them last would otherwise delete the rest.
*/

update public.orgs
   set settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object(
         'workspace_color', '#1F6F78',
         'phone',           '(512) 555-0147',
         'address',         'Austin, TX',
         'license_no',      'TX RCL-114862',
         'deposit',         jsonb_build_object('kind', 'percent', 'value', 30)
       )
 where slug = 'harbor-light-demo' and is_demo;

/* The temporary word goes; it was never part of this workspace. */
update public.orgs
   set settings = settings - 'estimate_word'
 where slug = 'harbor-light-demo' and is_demo;
