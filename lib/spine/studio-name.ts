/**
 * The name of the studio that set a workspace up, for pages with no session.
 *
 * WHY THIS EXISTS ALONGSIDE `studioFor`
 *
 * `studioFor` in workin.ts answers the same question and is the right one to
 * use inside the application: it goes through the `studio_for` RPC, which
 * needs a signed-in caller because two thirds of the answer is deliberately
 * unreadable from the client's side.
 *
 * The two places that were getting this wrong have no caller to be signed in.
 * A sign-in door is by definition read by somebody who is not signed in, and
 * an invoice is read by a customer who has no account at all. Both are server
 * components holding the service role, so they can follow the link directly -
 * the same `customers.linked_org_id` link `studio_for()`, `membership_origin()`
 * and `brandForOrg` all use.
 *
 * WHY IT RETURNS NULL RATHER THAN A FALLBACK
 *
 * Both callers previously printed a constant, which is how Harbor Light -
 * a Northwind Studio client - came to have CALO&CO's name at the foot of its
 * invoices. A studio nobody can name is better said as nothing than as a
 * guess: the line simply does not appear. Two studios linking to one
 * workspace is the same answer, because the product cannot know which of them
 * to name.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Who set this workspace up, or null.
 *
 * Null covers three cases that all mean the same thing on screen: nothing
 * links to this workspace, more than one thing does, or the lookup failed.
 */
export async function studioNameFor(
  db: SupabaseClient,
  clientOrgId: string
): Promise<string | null> {
  const { data: links, error } = await db
    .from('customers')
    .select('org_id')
    .eq('linked_org_id', clientOrgId)
    .limit(2);

  if (error || !links || links.length !== 1) return null;

  const agencyId = (links[0] as { org_id?: string }).org_id;
  if (!agencyId || agencyId === clientOrgId) return null;

  const { data: agency } = await db
    .from('orgs')
    .select('name')
    .eq('id', agencyId)
    .maybeSingle();

  const name = (agency as { name?: string } | null)?.name?.trim();
  return name || null;
}
