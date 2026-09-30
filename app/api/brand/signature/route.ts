/**
 * What this workspace's signature should start out saying.
 *
 * The Brand screen could read most of this from the browser, but not the
 * brand kit: for a client workspace the kit is a row in the AGENCY's table,
 * which the client's own session cannot see across and should not be able to.
 * So the server answers, with the service role, for the workspace the caller
 * is actually standing in.
 *
 * Nothing here is specific to one business. It fills from the org's own
 * settings and whichever kit is linked to it, so the same screen works for
 * the next client without an edit.
 */

import { NextResponse } from 'next/server';
import { whoIsCalling, serviceClient } from '@/lib/spine/api-caller';
import { brandForOrg } from '@/lib/spine/brand-for-org';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const caller = await whoIsCalling();
  if (!caller?.userId) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const db = serviceClient();
  if (!db) return NextResponse.json({ error: 'Server is not configured.' }, { status: 500 });

  const { data: profile } = await db
    .from('profiles').select('full_name, active_org_id').eq('id', caller.userId).maybeSingle();
  const orgId = (profile as { active_org_id?: string } | null)?.active_org_id;
  if (!orgId) return NextResponse.json({ error: 'No workspace open.' }, { status: 400 });

  const { data: org } = await db
    .from('orgs').select('name, settings').eq('id', orgId).maybeSingle();
  const settings = ((org as { settings?: Record<string, unknown> } | null)?.settings ?? {});
  const facts = await brandForOrg(db, orgId);

  /*
    The website, which a workspace may never have been asked for.

    `settings.website` is the answer when somebody filled it in. Where they
    have not, the brand kit's own site_url is the next best thing, and after
    that there is simply nothing to show - better an absent line than a guess
    at somebody's domain.
  */
  let website = String(settings.website ?? '').trim() || null;
  if (!website) {
    const { data: linked } = await db
      .from('customers').select('id').eq('linked_org_id', orgId).limit(1).maybeSingle();
    if (linked?.id) {
      const { data: brand } = await db
        .from('brands').select('site_url').eq('customer_id', linked.id).maybeSingle();
      website = (brand as { site_url?: string } | null)?.site_url?.trim() || null;
    }
  }

  return NextResponse.json({
    business: facts.name,
    person: (profile as { full_name?: string } | null)?.full_name ?? '',
    dark: facts.dark,
    logoUrl: facts.lockupPath ? `/api/brand/logo/${orgId}` : null,
    phone: String(settings.phone ?? '').trim() || null,
    email: String(settings.email ?? '').trim() || null,
    website,
    brandSource: facts.source,
  });
}
