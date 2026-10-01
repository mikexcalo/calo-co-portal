/**
 * Whose messaging this workspace sees, and whether it may change it.
 *
 * WHY THIS EXISTS
 *
 * Backlog #25. Colors, Logos and Voice learned to read across the
 * `customers.linked_org_id` link so a client whose kit belongs to their studio
 * sees their own brand. Messaging did not, because it is not in the kit: it is
 * its own table, keyed on `org_id`, and a studio writing a client's messaging
 * stores it under the STUDIO's org id against the client's brand. From inside
 * the client's workspace that row is unreachable, so the first client whose
 * studio writes their messaging opens the tab and finds it empty.
 *
 * THE OWNERSHIP RULE
 *
 * The studio owns messaging it wrote, and the client reads it without
 * changing it - the same bargain as the brand kit. Messaging a business wrote
 * for itself stays its own and stays editable. So the studio's copy wins where
 * there is one, and otherwise the workspace's own row is returned.
 *
 * WHY THE SERVER ANSWERS
 *
 * The studio's row is the studio's. A client's session cannot see across into
 * it and should not be able to; the service role reads it for the one
 * workspace the caller is standing in and nothing else crosses over.
 *
 * WHAT IS STILL UNDECIDED
 *
 * `brand_message` has one row per org and no notion of two authors, so a
 * business that wrote its own messaging and later gained a studio that writes
 * some too ends up with both. The studio's wins here and the earlier row is
 * left alone rather than deleted, which is recoverable but not visible. A
 * two-author view is its own brief.
 */

import { NextResponse } from 'next/server';
import { whoIsCalling, serviceClient } from '@/lib/spine/api-caller';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FIELDS = 'promise, positioning, audience, mission, tone, elevator, pillars';

export async function GET() {
  const caller = await whoIsCalling();
  if (!caller?.userId) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const db = serviceClient();
  if (!db) return NextResponse.json({ error: 'Server is not configured.' }, { status: 500 });

  const { data: profile } = await db
    .from('profiles').select('active_org_id').eq('id', caller.userId).maybeSingle();
  const orgId = (profile as { active_org_id?: string } | null)?.active_org_id;
  if (!orgId) return NextResponse.json({ error: 'No workspace open.' }, { status: 400 });

  /* The studio that set this workspace up, by the link every other cross-org
     read in the product already uses. */
  const { data: linked } = await db
    .from('customers').select('id, org_id').eq('linked_org_id', orgId).limit(1).maybeSingle();

  if (linked?.id) {
    const { data: brand } = await db
      .from('brands').select('id').eq('customer_id', linked.id).maybeSingle();
    const brandId = (brand as { id?: string } | null)?.id;
    if (brandId) {
      const { data: theirs } = await db
        .from('brand_message').select(FIELDS).eq('brand_id', brandId).maybeSingle();
      if (theirs) {
        const { data: studio } = await db
          .from('orgs').select('name').eq('id', (linked as { org_id?: string }).org_id ?? '').maybeSingle();
        return NextResponse.json({
          message: theirs,
          editable: false,
          keptBy: (studio as { name?: string } | null)?.name?.trim() || null,
        });
      }
    }
  }

  /*
    Its own, whatever brand row it happens to hang off.
    
    This used to insist on `brand_id is null`, which is how Tideline came to
    have messaging it had written and a tab that showed none of it: its row
    carries a brand id. One row per org is what the table actually holds, so
    the org is the key worth asking on.
  */
  const { data: own } = await db
    .from('brand_message').select(FIELDS).eq('org_id', orgId).limit(1).maybeSingle();

  return NextResponse.json({ message: own ?? null, editable: true, keptBy: null });
}
