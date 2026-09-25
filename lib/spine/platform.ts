/**
 * Who is building the platform, as opposed to using it.
 *
 * Some things in here are written by and for whoever runs Nautilus: the list
 * of tasks about GitHub branches and Supabase billing, and the digital plan
 * about a specific person's own domain and their own name in search results.
 *
 * Both were rendering in every workspace. A client opening Digital was told
 * "So searching Mike Calo finds you rather than an actor, a basketball player
 * and a college pitcher", and a studio owner's Home listed six maintenance
 * chores about somebody else's repository.
 *
 * There is already a precedent for naming the org that owns the platform:
 * STRIPE_OWNER_ORG, which decides whose bank account a card payment reaches.
 * This is the same idea for content rather than money, and it defaults to the
 * same slug, so nothing has to be configured for it to be correct today.
 *
 * It is a display gate and nothing more. It decides what is worth showing
 * somebody, never what they are allowed to reach — that is row-level
 * security's job, and pretending otherwise is how you end up with a wall made
 * of wallpaper.
 */

const PLATFORM_ORG_SLUG = (
  process.env.NEXT_PUBLIC_PLATFORM_ORG || 'calo-co'
).trim();

/** True only in the workspace that builds and ships this software. */
export function isPlatformOrg(slug: string | null | undefined): boolean {
  return !!slug && slug.trim() === PLATFORM_ORG_SLUG;
}
