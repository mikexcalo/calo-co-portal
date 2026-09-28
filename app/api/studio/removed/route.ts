/**
 * Telling the studio they have been shown out.
 *
 * The client ends the arrangement from their Security screen and that is
 * their right, but the studio finding out by trying to open a workspace and
 * failing is the wrong way round: they are usually mid-something, and the
 * first thing they will do is assume it is broken and go looking.
 *
 * WHY THE CLIENT CANNOT NAME THE RECIPIENT
 *
 * The route takes only the workspace. Who to write to is resolved here, from
 * the `customers` row that links the studio to it - a row `remove_studio`
 * deliberately leaves alone, because the arrangement ending is not the same
 * as the client record disappearing. Nothing a browser sends decides where
 * this lands.
 *
 * It runs after the removal, not instead of it. A mail server being down must
 * never be the reason somebody cannot get their own workspace back.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServer } from '@/lib/supabase-server';
import { postEmail } from '@/lib/spine/deliverable';
import { apiError } from '@/lib/spine/errors';
import { PRODUCT } from '@/lib/brand';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ ok: true, sent: false, why: 'not configured' });
    }

    const me = (await createSupabaseServer().auth.getUser()).data.user;
    if (!me) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
    }

    const { orgId } = (await req.json()) as { orgId?: string };
    if (!orgId) return NextResponse.json({ error: 'Which workspace?' }, { status: 400 });

    const db = createClient(url, key, { auth: { persistSession: false } });

    /* The same test the database function applies, asked again here: this
       notice says "your client removed you", and only that client may cause
       it to be sent. */
    const { data: mine } = await db
      .from('memberships')
      .select('role, origin')
      .eq('user_id', me.id)
      .eq('org_id', orgId)
      .maybeSingle();

    if (mine?.role !== 'owner' || mine?.origin !== 'own') {
      return NextResponse.json({ error: 'Not yours to do.' }, { status: 403 });
    }

    /* And it only goes out if the removal actually happened. */
    const { data: left } = await db
      .from('memberships')
      .select('user_id')
      .eq('org_id', orgId)
      .eq('origin', 'studio');
    if ((left ?? []).length > 0) {
      return NextResponse.json({ ok: true, sent: false, why: 'studio still here' });
    }

    const [{ data: workspace }, { data: link }] = await Promise.all([
      db.from('orgs').select('name').eq('id', orgId).maybeSingle(),
      db.from('customers').select('org_id').eq('linked_org_id', orgId).limit(1).maybeSingle(),
    ]);

    const studioOrg = (link as { org_id?: string } | null)?.org_id ?? null;
    if (!studioOrg) return NextResponse.json({ ok: true, sent: false, why: 'no studio on record' });

    const { data: owner } = await db
      .from('memberships')
      .select('user_id')
      .eq('org_id', studioOrg)
      .eq('role', 'owner')
      .order('created_at')
      .limit(1)
      .maybeSingle();

    const ownerId = (owner as { user_id?: string } | null)?.user_id ?? null;
    if (!ownerId) return NextResponse.json({ ok: true, sent: false, why: 'studio has no owner' });

    const { data: who } = await db.auth.admin.getUserById(ownerId);
    const to = who?.user?.email ?? null;
    if (!to) return NextResponse.json({ ok: true, sent: false, why: 'no address' });

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) return NextResponse.json({ ok: true, sent: false, why: 'mail not configured' });

    const name = (workspace as { name?: string } | null)?.name ?? 'A workspace';

    const res = await postEmail(to, {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || `${PRODUCT} <onboarding@resend.dev>`,
        to,
        subject: `${name} removed you from their workspace`,
        html: `<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:15px;line-height:1.65;color:#111;max-width:520px;">
<p><strong>${name}</strong> has removed you from their workspace.</p>
<p>Your access ended, along with any standing permission to work in it and any session that was open. Everything you wrote for them is still there; it is theirs.</p>
<p style="color:#666;font-size:13px;margin-top:22px;">They can ask you back, and that would need their permission again.</p>
</div>`,
      }),
    });

    return NextResponse.json({ ok: true, sent: res.ok });
  } catch (e) {
    /* Never fail the client's own action because a notice could not go out. */
    return NextResponse.json(apiError('studio/removed', e), { status: 200 });
  }
}
