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

    /**
     * The invitation is sent by us, not by Supabase.
     *
     * inviteUserByEmail goes out through Supabase's built-in mail, which is
     * rate limited to a handful an hour and arrives from a domain nobody
     * recognises, so invitations either did not send or landed in spam. That
     * is why getting somebody into this product has meant asking for a link by
     * hand.
     *
     * calo.company is already verified with Resend, so the account is created
     * here and the email goes out from the same domain as everything else.
     */
    const { data: targetOrg } = await admin.from('orgs').select('name').eq('id', orgId).maybeSingle();
    const orgName = targetOrg?.name ?? 'the workspace';

    let link: string | null = null;

    if (!userId) {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: body.fullName?.trim() ? { full_name: body.fullName.trim() } : undefined,
      });
      if (createErr) {
        return NextResponse.json({ error: `Could not create the account: ${createErr.message}` }, { status: 502 });
      }
      userId = created.user?.id ?? null;
      invited = true;
    }

    /**
     * One link, whether the person is new or already had an account.
     *
     * A recovery link signs them in and drops them on a screen where they set
     * their own password, which is the same thing a new joiner and a returning
     * one both need. No password is ever generated, written down, or passed
     * through anybody.
     */
    {
      const { data: gen } = await admin.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo: `${req.nextUrl.origin}/welcome` },
      });
      link = gen?.properties?.action_link ?? null;
    }

    if (!userId) {
      return NextResponse.json({ error: 'Could not resolve the user' }, { status: 500 });
    }

    /**
     * A profile row must exist before a membership means anything — the org
     * wall reads active_org_id from it.
     *
     * But only set active_org_id when there is nothing there yet. Adding an
     * existing person to a second business must not silently move them out of
     * the one they were looking at: they would carry on working, under a
     * heading that no longer matches the data underneath. That exact failure
     * has already put one client's price list under another client's name.
     */
    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id, active_org_id, full_name')
      .eq('id', userId)
      .maybeSingle();

    const profileErr = existingProfile
      ? (
          await admin
            .from('profiles')
            .update({
              full_name: existingProfile.full_name ?? body.fullName?.trim() ?? null,
              active_org_id: existingProfile.active_org_id ?? orgId,
            })
            .eq('id', userId)
        ).error
      : (
          await admin.from('profiles').insert({
            id: userId,
            full_name: body.fullName?.trim() || null,
            active_org_id: orgId,
          })
        ).error;

    if (profileErr) throw new Error(profileErr.message);

    const { error: joinErr } = await admin
      .from('memberships')
      .upsert({ user_id: userId, org_id: orgId, role }, { onConflict: 'user_id,org_id' });

    if (joinErr) throw new Error(joinErr.message);

    /**
     * Sent from our own domain, and handed back either way.
     *
     * If the mail service is having a bad day, the person inviting still has a
     * link they can paste into a text message. An invitation that fails
     * silently is how somebody ends up asking for one by hand.
     */
    let emailed = false;
    const resendKey = process.env.RESEND_API_KEY;
    const from = process.env.MAIL_FROM;

    if (link && resendKey && from) {
      const who = body.fullName?.trim() || email.split('@')[0];
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          to: email,
          subject: `You have been added to ${orgName}`,
          html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.65;color:#141414;max-width:520px;">
            <p>Hi ${who},</p>
            <p>You have been given access to <strong>${orgName}</strong>.</p>
            <p>The button below signs you in and lets you set your own password. Nobody has one for you.</p>
            <p style="margin:26px 0;">
              <a href="${link}" style="background:#141414;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:500;display:inline-block;">Set your password</a>
            </p>
            <p style="color:#5B6069;font-size:13.5px;">This link works once and expires in about a day. If it has, ask for another.</p>
          </div>`,
        }),
      });
      emailed = res.ok;
    }

    return NextResponse.json({
      ok: true,
      emailed,
      // Always returned, so the screen can offer a copy button.
      link,
      message: emailed
        ? `Sent to ${email}. They set their own password from the email.`
        : `Account ready for ${email}, but the email did not send. Copy the link below and send it yourself.`,
    });
  } catch (e) {
    const msg = (e as Error).message;
    console.error('[team/invite]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
