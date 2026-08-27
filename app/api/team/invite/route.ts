/**
 * Invite someone into a business.
 *
 * Until now memberships were created by hand in SQL, which is fine for the
 * first user and wrong by the third. This makes it a form.
 *
 * Two guards worth understanding:
 *
 *  - Only an owner/admin of the target business can invite into it. The
 *    caller's session is verified server-side; the client saying "I'm an
 *    admin" counts for nothing.
 *  - An existing user gets a membership added, not a new account. Inviting
 *    someone who already has a login should widen their access, never create
 *    a second orphan account with the same email.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

interface Body {
  email?: string;
  orgId?: string;
  role?: 'owner' | 'admin' | 'member';
  fullName?: string;
}

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !serviceKey || !anonKey) {
    return NextResponse.json(
      { error: 'Server is missing Supabase configuration' },
      { status: 500 }
    );
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const orgId = body.orgId;
  const role = body.role ?? 'member';

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
  }
  if (!orgId) {
    return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
  }

  // Verify the CALLER, from their bearer token — never from the request body.
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: caller, error: callerErr } = await admin.auth.getUser(token);
  if (callerErr || !caller?.user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  // Is the caller allowed to invite into THIS business?
  const { data: membership, error: memErr } = await admin
    .from('memberships')
    .select('role')
    .eq('user_id', caller.user.id)
    .eq('org_id', orgId)
    .maybeSingle();

  if (memErr) {
    return NextResponse.json({ error: memErr.message }, { status: 500 });
  }
  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json(
      { error: 'You need to be an owner or admin of that business to invite people.' },
      { status: 403 }
    );
  }

  try {
    // Does this email already have an account?
    const { data: existing } = await admin.auth.admin.listUsers();
    const found = existing?.users?.find(
      (u) => u.email?.toLowerCase() === email
    );

    let userId = found?.id ?? null;
    let invited = false;

    if (!userId) {
      const { data: inviteData, error: inviteErr } =
        await admin.auth.admin.inviteUserByEmail(email, {
          redirectTo: `${req.nextUrl.origin}/auth/callback`,
        });

      if (inviteErr) {
        // The most common cause by far is Supabase's built-in email being
        // rate-limited or unconfigured. Say which, so it's fixable.
        return NextResponse.json(
          {
            error: `Could not send the invite: ${inviteErr.message}`,
            hint: 'Supabase\'s built-in email is heavily rate-limited. Configure SMTP under Authentication → Emails to send reliably.',
          },
          { status: 502 }
        );
      }

      userId = inviteData.user?.id ?? null;
      invited = true;
    }

    if (!userId) {
      return NextResponse.json({ error: 'Could not resolve the user' }, { status: 500 });
    }

    // A profile row must exist before a membership means anything — the org
    // wall reads active_org_id from it.
    const { error: profileErr } = await admin
      .from('profiles')
      .upsert(
        {
          id: userId,
          full_name: body.fullName?.trim() || null,
          active_org_id: orgId,
        },
        { onConflict: 'id' }
      );

    if (profileErr) throw new Error(profileErr.message);

    const { error: joinErr } = await admin
      .from('memberships')
      .upsert({ user_id: userId, org_id: orgId, role }, { onConflict: 'user_id,org_id' });

    if (joinErr) throw new Error(joinErr.message);

    return NextResponse.json({
      ok: true,
      invited,
      message: invited
        ? `Invite sent to ${email}. They'll get an email to set a password.`
        : `${email} already had an account — they've been added to this business.`,
    });
  } catch (e) {
    const msg = (e as Error).message;
    console.error('[team/invite]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
