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

  /*
    One walk, not three. `brandForOrg` already reads the org row and the kit
    to answer the brand question, so it hands back the settings and the kit's
    site_url rather than this asking for either of them again.
  */
  const facts = await brandForOrg(db, orgId);
  const settings = facts.settings;

  /*
    The website, which a workspace may never have been asked for.

    `settings.website` is the answer when somebody filled it in. Where they
    have not, the brand kit's own site_url is the next best thing, and after
    that there is simply nothing to show - better an absent line than a guess
    at somebody's domain.
  */
  const website = String(settings.website ?? '').trim() || facts.siteUrl;

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
