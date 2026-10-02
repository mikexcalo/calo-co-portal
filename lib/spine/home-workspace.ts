/**
 * Where a sign-in lands.
 *
 * WHY THIS EXISTS
 *
 * `active_org_id` is where you last were, which is the right answer while you
 * are working and the wrong one the next morning. A studio member spends the
 * day inside a client's workspace, closes the laptop, signs in again and is
 * still standing in that client - looking at their jobs, their invoices and
 * their money, under their name, with every write going to their rows. The
 * studio's own business is one switch away and nothing on screen says you are
 * not in it.
 *
 * So a sign-in puts you back in your own business. Not the last one you
 * visited.
 *
 * WHY `origin` AND NOT `kind = 'agency'`
 *
 * `memberships.origin` is stamped on insert by `membership_origin()` and says
 * which side of the table a membership is: `own` for a business's own people,
 * `studio` for the people who build for them. That is exactly the question
 * being asked here, and it answers it for everybody rather than only for
 * studios - a client's own team has one `own` membership too, and lands in
 * their own workspace, which is where they already were.
 *
 * WHY EXACTLY ONE
 *
 * The callback route carries a warning worth repeating: an upsert that
 * rewrote `active_org_id` on every sign-in quietly moved anyone with more than
 * one business back to whichever came first, and a price list was displayed
 * under the wrong company's name because of it. The fix is not to guess
 * better. Somebody who genuinely owns two businesses has two `own`
 * memberships and no single right answer, so this leaves them where they
 * were. Nobody with an `own` membership at all is in the same position.
 *
 * Never an error, either way. Landing somewhere slightly stale is a small
 * thing; refusing a sign-in over it is not.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Put this person back in their own business, if they have exactly one.
 *
 * Takes the service role, because `memberships` is readable only within the
 * workspace you are currently standing in - which is the client's, which is
 * the whole problem.
 *
 * Returns the workspace landed in, or null when nothing was changed.
 */
export async function landInYourOwn(
  admin: SupabaseClient,
  userId: string
): Promise<string | null> {
  try {
    const { data: own, error } = await admin
      .from('memberships')
      .select('org_id')
      .eq('user_id', userId)
      .eq('origin', 'own')
      .limit(2);

    if (error || !own || own.length !== 1) return null;

    const home = (own[0] as { org_id?: string }).org_id;
    if (!home) return null;

    const { data: profile } = await admin
      .from('profiles')
      .select('active_org_id')
      .eq('id', userId)
      .maybeSingle();

    /* Already there. Not worth a write, and a write here would touch
       `updated_at` on every page a magic link ever opens. */
    if ((profile as { active_org_id?: string } | null)?.active_org_id === home) return null;

    const { error: wrote } = await admin
      .from('profiles')
      .update({ active_org_id: home })
      .eq('id', userId);

    return wrote ? null : home;
  } catch {
    return null;
  }
}
