/**
 * Send an invoice as a link, without going through Stripe.
 *
 * The existing send route hands the invoice to Stripe, which means card fees
 * whether or not the customer wants to pay by card. This one emails a link to
 * the invoice page, where every method the business accepts is listed.
 *
 * Stripe stays available for anyone who wants instant card payment. It just
 * stops being the only way to send a bill.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const runtime = 'nodejs';

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

  let invoiceId: string | undefined;
  let to: string | undefined;
  let previewOnly: boolean | undefined;
  try {
    ({ invoiceId, to, previewOnly } = await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  if (!invoiceId) return NextResponse.json({ error: 'invoiceId is required' }, { status: 400 });

  const db = createClient(url, key, { auth: { persistSession: false } });

  try {
    const { data: inv, error } = await db
      .from('job_invoices')
      .select('id, number, total, amount_paid, public_token, org_id, due_on, job:jobs(name, customer:customers(name, contact_name, email))')
      .eq('id', invoiceId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!inv) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    const job = one<{ name: string; customer: unknown }>(inv.job);
    const customer = one<{ name: string; contact_name: string | null; email: string | null }>(
      job?.customer
    );

    const recipient = to?.trim() || customer?.email;
    if (!recipient) {
      return NextResponse.json(
        { error: 'That customer has no email address, so there is nowhere to send it.' },
        { status: 400 }
      );
    }

    // Reuse an existing token so resending doesn't break a link already open.
    const token = inv.public_token ?? crypto.randomBytes(18).toString('hex');
    const link = `${req.nextUrl.origin}/i/${token}`;

    const { data: org } = await db
      .from('orgs')
      .select('name, payment_methods')
      .eq('id', inv.org_id)
      .maybeSingle();

    const methods = ((org?.payment_methods ?? []) as Array<{ enabled: boolean }>).filter(
      (m) => m.enabled
    );

    /**
     * A preview mints the link and stops there.
     *
     * Looking at your own invoice must not mark it sent. Otherwise checking
     * how it turned out silently tells the app a customer has it, the
     * overdue clock starts, and Today begins chasing you about a bill nobody
     * ever received.
     */
    const upd = await db
      .from('job_invoices')
      .update(
        previewOnly
          ? { public_token: token }
          : { public_token: token, status: 'sent', sent_at: new Date().toISOString() }
      )
      .eq('id', inv.id);
    if (upd.error) throw new Error(upd.error.message);

    if (previewOnly) {
      return NextResponse.json({ ok: true, link, preview: true });
    }

    const owed = Number(inv.total) - Number(inv.amount_paid);

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
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
        to: recipient,
        subject: `Invoice ${inv.number} from ${org?.name ?? 'us'}`,
        html: `<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:15px;line-height:1.65;color:#111;max-width:520px;">
<p>${greeting},</p>
<p>Invoice <strong>${inv.number}</strong>${job?.name ? ` for ${job.name}` : ''}.</p>
<p style="font-size:24px;font-weight:600;margin:18px 0;">$${owed.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
${inv.due_on ? `<p style="color:#666;">Due ${inv.due_on}</p>` : ''}
<p><a href="${link}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:13px 24px;border-radius:8px;font-weight:600;">View invoice</a></p>
<p style="color:#666;font-size:13px;margin-top:22px;">${
          methods.length
            ? 'The invoice page lists every way you can pay.'
            : 'Reply to this email to arrange payment.'
        }</p>
<p style="color:#666;font-size:13px;">${org?.name ?? ''}</p>
</div>`,
      }),
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      return NextResponse.json({
        ok: true,
        link,
        message: `Saved, but the email failed: ${payload?.message ?? res.status}. Send this link by hand.`,
      });
    }

    return NextResponse.json({ ok: true, link, message: `Sent to ${recipient}.` });
  } catch (e) {
    console.error('[invoices/share]', (e as Error).message);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
