/**
 * Email an invoice as a link.
 *
 * Estimates could already do this; invoices could not. Sending one meant
 * either routing it through Stripe, which means card fees whether or not the
 * customer wants to pay by card, or copying a link into your own email client
 * by hand and losing any record that it went.
 *
 * WHY THE CUSTOMER NEVER MAKES AN ACCOUNT
 * The link carries a long random token and that token IS the permission. It
 * grants exactly one thing: read this one invoice. No sign-up, no password, no
 * "create an account to view your bill" — which is the single most reliable way
 * to make somebody not pay today.
 *
 * The trade is that anyone holding the link can see the invoice, so it is
 * treated like the paper one it replaces: fine to email, not to publish.
 *
 * IF THE CUSTOMER HAPPENS TO BE ON THE PLATFORM
 * A business you invoice may also have a workspace here, which is exactly the
 * CALO&CO and Mammoth relationship. When that is true they get a notification
 * in the app as well as the email, so the bill turns up where they already are.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const maxDuration = 30;

const money = (n: number) =>
  `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Server is not configured' }, { status: 500 });
  }

  let body: { invoiceId?: string; to?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  if (!body.invoiceId) {
    return NextResponse.json({ error: 'invoiceId is required' }, { status: 400 });
  }

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  try {
    const { data: inv, error } = await db
      .from('job_invoices')
      .select(
        'id, number, total, amount_paid, due_on, public_token, org_id, job:jobs(name, customer:customers(name, contact_name, email, linked_org_id))'
      )
      .eq('id', body.invoiceId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!inv) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    const job = Array.isArray(inv.job) ? inv.job[0] : inv.job;
    const customer = job?.customer
      ? Array.isArray(job.customer)
        ? job.customer[0]
        : job.customer
      : null;

    const to = body.to?.trim() || customer?.email;
    if (!to) {
      return NextResponse.json(
        {
          error: `There's no email address for ${customer?.name ?? 'this customer'}. Add one on their record, or send the link by hand.`,
        },
        { status: 400 }
      );
    }

    // Reuse an existing token so resending never breaks a link already open
    // on somebody's phone.
    const token = inv.public_token ?? crypto.randomBytes(18).toString('hex');
    const origin = req.nextUrl.origin;
    const link = `${origin}/i/${token}`;

    const { data: org } = await db
      .from('orgs')
      .select('name')
      .eq('id', inv.org_id)
      .maybeSingle();

    const upd = await db
      .from('job_invoices')
      .update({
        public_token: token,
        sent_at: new Date().toISOString(),
        // Draft stops being the right word the moment a customer can read it.
        status: 'sent',
      })
      .eq('id', inv.id)
      .eq('status', 'draft');
    if (upd.error) throw new Error(upd.error.message);

    // Make sure the token is saved even when the status was already 'sent'.
    if (!inv.public_token) {
      await db.from('job_invoices').update({ public_token: token }).eq('id', inv.id);
    }

    const owed = Number(inv.total) - Number(inv.amount_paid ?? 0);

    /**
     * The in-app copy, for a customer who is also on the platform. Written
     * before the email is attempted so a mail outage does not also cost them
     * the notification.
     */
    if (customer?.linked_org_id) {
      await db.from('notifications').insert({
        org_id: customer.linked_org_id,
        kind: 'invoice',
        title: `New invoice from ${org?.name ?? 'your agency'}`,
        body: `${inv.number} for ${money(owed)}, due ${inv.due_on ?? 'on receipt'}.`,
        href: '/account',
      });
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      return NextResponse.json({
        ok: true,
        link,
        message:
          'Email is not switched on yet, so nothing was sent. The link below works right now, send it however you like.',
      });
    }

    const greeting = customer?.contact_name || customer?.name || 'Hello';
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || 'CALO&CO <onboarding@resend.dev>',
        to,
        subject: `Invoice ${inv.number} from ${org?.name ?? 'us'}`,
        html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.65;color:#111;max-width:520px;">
<p>${greeting},</p>
<p>Here's invoice <strong>${inv.number}</strong>${job?.name ? ` for ${job.name}` : ''}.</p>
<p style="font-size:26px;font-weight:600;margin:18px 0 6px;">${money(owed)}</p>
${inv.due_on ? `<p style="color:#666;font-size:13px;margin:0 0 18px;">Due ${inv.due_on}</p>` : ''}
<p><a href="${link}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:13px 24px;border-radius:8px;font-weight:600;">View invoice</a></p>
<p style="color:#666;font-size:13px;margin-top:22px;">That page shows every way you can pay, and you don't need an account to open it. Reply to this email with any questions.</p>
<p style="color:#666;font-size:13px;">${org?.name ?? ''}</p>
</div>`,
      }),
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      return NextResponse.json({
        ok: true,
        link,
        message: `The invoice is ready, but the email didn't go: ${payload?.message ?? res.status}. Send this link by hand.`,
      });
    }

    return NextResponse.json({ ok: true, link, message: `Sent to ${to}.` });
  } catch (e) {
    console.error('[invoices/email]', (e as Error).message);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
