-- Harbor Light Roofing has no brand kit, so the identity strip resolved it to
-- the same grey as Blank Co — and the whole point of the strip is that two
-- workspaces do not look alike.
--
-- Set through settings.workspace_color, which is the new control on What You
-- See, rather than by inventing a brand kit it does not have. That is the
-- path a studio owner would use for exactly this case, so it is worth the
-- demo exercising it.
--
-- A harbour light is a beacon, and teal sits apart from Ember's red and
-- Tideline's near-black at four pixels, which is the only size that matters
-- here.
update public.orgs
   set settings = coalesce(settings, '{}'::jsonb) || '{"workspace_color": "#1F6F78"}'::jsonb
 where slug = 'harbor-light-demo';
