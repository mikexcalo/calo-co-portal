/**
 * Asking a client to do something, from your side of the wall.
 *
 * Notifications are walled to the workspace you are standing in, which is
 * right — nothing should be able to write into somebody else's business just
 * because it knows the id. So this checks the caller actually belongs to the
 * workspace being written to, and only then uses the service role to put the
 * row there.
 *
 * It lands in their bell and on their home screen, because a task that only
 * exists in a tray is a task somebody has to go looking for.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Server is not configured for this yet.' }, { status: 503 });
  }

  let body: { orgId?: string; title?: string; detail?: string; href?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const orgId = body.orgId;
  const title = body.title?.trim();
  if (!orgId) return NextResponse.json({ error: 'Which workspace?' }, { status: 400 });
  if (!title) return NextResponse.json({ error: 'Say what you are asking for.' }, { status: 400 });

  // The caller, from their token. Never from the body.
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: caller, error: callerErr } = await admin.auth.getUser(token);
  if (callerErr || !caller?.user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  // Membership is the whole permission. Belonging to the workspace is what
  // entitles you to put something on their screen.
  const { data: member } = await admin
    .from('memberships')
    .select('role')
    .eq('user_id', caller.user.id)
    .eq('org_id', orgId)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ error: 'You do not belong to that workspace.' }, { status: 403 });
  }

  const { error } = await admin.from('notifications').insert({
    org_id: orgId,
    kind: 'system',
    title,
    body: body.detail?.trim() || null,
    href: body.href?.trim() || null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
