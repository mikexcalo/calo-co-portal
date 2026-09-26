/**
 * Who gets told when something happens in a business's workspace.
 *
 * This existed as `ALERT_EMAIL` - one address, in an environment variable,
 * belonging to us. Every acceptance from every client's customer arrived in
 * the studio's inbox and nowhere else, which gets the audience exactly
 * backwards: the proposal is the business's, the customer is theirs, the
 * deposit draft is sitting in their Invoices waiting for them to send it. We
 * are the ones who should be copied, if anybody.
 *
 * WHY `origin` AND NOT `role`
 *
 * The obvious query is `role = 'owner'`, and it returns the wrong person. In
 * every client workspace today the studio is the owner and the business is an
 * admin - the arrangement backlog #12 exists to undo - so asking for the
 * owner of Mammoth returns us, and the mail goes back to exactly where it
 * should have stopped going.
 *
 * `origin` is the question actually being asked: who here is this business's
 * own people. That answer is right now, and stays right after #12 flips the
 * roles, which is the test of whether a rule is the real one.
 *
 * Read with the service role because a public page has no session. Only what
 * is needed to address an email comes back.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface TellThem {
  /** The business's own person. Null when nobody here has a reachable email. */
  to: string | null;
  /** The studio that set the workspace up, copied. Never the only recipient
   *  unless the business has nobody to write to. */
  cc: string | null;
  /** Why `to` is null, for the log. Empty when it is not. */
  why: string;
}

async function emailOf(db: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await db.auth.admin.getUserById(userId);
  const email = data?.user?.email?.trim();
  return email || null;
}

export async function whoToTell(
  db: SupabaseClient,
  orgId: string | null | undefined
): Promise<TellThem> {
  if (!orgId) return { to: null, cc: null, why: 'no workspace' };

  /*
    Their own people, senior first.

    Ordered rather than filtered to one role: a business whose owner seat is
    the studio's still has an admin, and an admin of your own business is
    unambiguously somebody who should hear that a customer signed.
  */
  const mine = await db
    .from('memberships')
    .select('user_id, role')
    .eq('org_id', orgId)
    .eq('origin', 'own');

  const rank = (r: string) => (r === 'owner' ? 0 : r === 'admin' ? 1 : 2);
  const people = ((mine.data ?? []) as { user_id: string; role: string }[])
    .sort((a, b) => rank(a.role) - rank(b.role));

  let to: string | null = null;
  for (const p of people) {
    to = await emailOf(db, p.user_id);
    if (to) break;
  }

  /* The studio, copied. studio_for() needs a session, so the link is read
     directly here - the service role has none. */
  let cc: string | null = null;
  const link = await db
    .from('customers')
    .select('org_id')
    .eq('linked_org_id', orgId)
    .limit(1)
    .maybeSingle();

  const studioOrg = (link.data as { org_id?: string } | null)?.org_id ?? null;
  if (studioOrg) {
    const owner = await db
      .from('memberships')
      .select('user_id')
      .eq('org_id', studioOrg)
      .eq('role', 'owner')
      .order('created_at')
      .limit(1)
      .maybeSingle();
    const id = (owner.data as { user_id?: string } | null)?.user_id ?? null;
    if (id) cc = await emailOf(db, id);
  }

  /* Never send the same person two copies of one thing. */
  if (cc && to && cc.toLowerCase() === to.toLowerCase()) cc = null;

  return {
    to,
    cc,
    why: to ? '' : people.length ? 'nobody in their team has an email' : 'no member of their own team',
  };
}
