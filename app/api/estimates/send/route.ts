/**
 * Send an estimate to the customer for a decision.
 *
 * Mints a capability token, emails a link, and marks the estimate sent. The
 * token is generated here rather than at creation so an estimate that was
 * never sent has no live public URL.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const runtime = 'nodejs';

/**
 * Supabase types an embedded relation as an array even when it is
 * many-to-one, where the runtime value is a single object. Normalize both.
 */
function one<T>(v: unknown): T | null {
  if (v == null) return null;
  return (Array.isArray(v) ? v[0] ?? null : v) as T | null;
}


export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'Server is not configured' }, { status: 500 });
  }

  let estimateId: string | undefined;
  let toOverride: string | undefined;
  try {
    ({ estimateId, to: toOverride } = await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  if (!estimateId) return NextResponse.json({ error: 'estimateId is required' }, { status: 400 });

  const db = createClient(url, key, { auth: { persistSession: false } });

  try {
    const { data: est, error } = await db
      .from('estimates')
      .select('id, public_token, total, org_id, job:jobs(name, customer:customers(name, contact_name, email))')
      .eq('id', estimateId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!est) return NextResponse.json({ error: 'Estimate not found' }, { status: 404 });

    const job = one<{
      name: string;
      customer: { name: string; contact_name: string | null; email: string | null } | null;
    }>(est.job);
    const customer = one<{ name: string; contact_name: string | null; email: string | null }>(
      job?.customer
    );

    const to = toOverride?.trim() || customer?.email;
    if (!to) {
      return NextResponse.json(
        { error: 'That customer has no email address, so there is nowhere to send it.' },
        { status: 400 }
      );
    }

    // Reuse an existing token so resending doesn't invalidate a link the
    // customer may already have open.
    const token = est.public_token ?? crypto.randomBytes(18).toString('hex');
    const origin = req.nextUrl.origin;
    const link = `${origin}/e/${token}`;

    const { data: org } = await db.from('orgs').select('name').eq('id', est.org_id).maybeSingle();

    const upd = await db
      .from('estimates')
      .update({ public_token: token, status: 'sent', sent_at: new Date().toISOString(), sent_to: to })
      .eq('id', est.id);
    if (upd.error) throw new Error(upd.error.message);

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      // The link is still valid — hand it back so it can be sent by hand.
      return NextResponse.json({
        ok: true,
        link,
        message: 'Email is not configured yet, so nothing was sent. Copy this link to the customer.',
      });
    }

    const greeting = customer?.contact_name || customer?.name || 'Hello';
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || 'CALO&CO <onboarding@resend.dev>',
        to,
        subject: `Your estimate from ${org?.name ?? 'us'} — ${job?.name ?? ''}`,
        html: `<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:15px;line-height:1.65;color:#111;max-width:520px;">
<p>${greeting},</p>
<p>Here's the estimate for <strong>${job?.name ?? 'your project'}</strong>.</p>
<p style="font-size:22px;font-weight:600;margin:18px 0;">$${Number(est.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
<p><a href="${link}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:13px 24px;border-radius:8px;font-weight:600;">View and respond</a></p>
<p style="color:#666;font-size:13px;margin-top:22px;">You can accept or decline from that page — no account needed. Reply to this email with any questions.</p>
<p style="color:#666;font-size:13px;">${org?.name ?? ''}</p>
</div>`,
      }),
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      return NextResponse.json(
        { ok: true, link, message: `Saved, but the email failed: ${payload?.message ?? res.status}. Send this link by hand.` },
        { status: 200 }
      );
    }

    return NextResponse.json({ ok: true, link, message: `Sent to ${to}.` });
  } catch (e) {
    console.error('[estimates/send]', (e as Error).message);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
