/**
 * Whose business this document is, by name.
 *
 * "Call Dana" is a person and "call the contractor" is a chore, so a document
 * that can name somebody should. The name comes from whoever owns the
 * workspace, or from the signature the business has set for what it sends.
 *
 * Read with the service role, on a public page, on purpose: this is the
 * business's own name being shown to the business's own customer, which is
 * the one piece of identity a document is for. Nothing else about that person
 * is returned - no email, no id.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface DocOwner {
  fullName: string;
  firstName: string;
}

export async function ownerOf(
  db: SupabaseClient,
  orgId: string | null | undefined
): Promise<DocOwner | null> {
  if (!orgId) return null;

  const org = await db.from('orgs').select('settings').eq('id', orgId).maybeSingle();
  const signature = (
    ((org.data?.settings as Record<string, unknown> | undefined)?.signature as { name?: string } | undefined)
      ?.name ?? ''
  ).trim();

  const whole = signature || (await (async () => {
    /* Two queries: memberships.user_id points at auth.users, not profiles, so
       there is no relationship for PostgREST to embed through. */
    const m = await db
      .from('memberships')
      .select('user_id')
      .eq('org_id', orgId)
      .eq('role', 'owner')
      .order('created_at')
      .limit(1)
      .maybeSingle();
    const uid = (m.data as { user_id?: string } | null)?.user_id;
    if (!uid) return '';
    const p = await db.from('profiles').select('full_name').eq('id', uid).maybeSingle();
    return ((p.data as { full_name?: string } | null)?.full_name ?? '').trim();
  })());

  if (!whole) return null;
  return { fullName: whole, firstName: whole.split(/\s+/)[0] };
}
