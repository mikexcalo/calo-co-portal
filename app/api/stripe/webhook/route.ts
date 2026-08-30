/**
 * Stripe webhook — this is what makes payment status stop being manual.
 *
 * When a customer actually pays, Stripe calls this and the invoice marks
 * itself paid. Nobody has to remember.
 *
 * Signature verification is mandatory: this endpoint is public, so without it
 * anyone could POST "invoice.paid" and mark your invoices settled.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const runtime = 'nodejs';

/**
 * Verifies Stripe's signature header.
 * Format: t=<timestamp>,v1=<hmac>. The signed payload is `${t}.${body}`.
 */
function verify(payload: string, header: string | null, secret: string): boolean {
  if (!header) return false;

  const parts = Object.fromEntries(
    header.split(',').map((p) => {
      const i = p.indexOf('=');
      return [p.slice(0, i), p.slice(i + 1)];
    })
  );

  const timestamp = parts['t'];
  const signature = parts['v1'];
  if (!timestamp || !signature) return false;

  // Reject replays of old events (5 minute window).
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');

  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  // Constant-time compare — length check first, since timingSafeEqual throws
  // on mismatched lengths.
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Email alert for the events worth interrupting someone over. Best-effort —
 * a mail failure must never fail the webhook, or Stripe retries a payment we
 * already recorded.
 */
async function notifyByEmail(subject: string, body: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.ALERT_EMAIL || 'mikexcalo@gmail.com';
  if (!key) return;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || 'CALO&CO <onboarding@resend.dev>',
        to,
        subject,
        html: `<div style="font-family:-apple-system,sans-serif;font-size:15px;line-height:1.6;">
<p>${body}</p>
<p><a href="https://nautilusapp.vercel.app/billing" style="color:#006AFF;">Open Billing →</a></p></div>`,
      }),
    });
  } catch (e) {
    console.error('[stripe/webhook] alert email:', e);
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret || !supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 501 });
  }

  // Must read the RAW body — parsing it first would change the bytes and
  // break signature verification.
  const raw = await req.text();

  if (!verify(raw, req.headers.get('stripe-signature'), secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const obj = event.data.object;
  const stripeInvoiceId = obj.id as string | undefined;
  if (!stripeInvoiceId) return NextResponse.json({ received: true });

  const cents = (v: unknown) => (typeof v === 'number' ? v / 100 : 0);

  try {
    switch (event.type) {
      case 'invoice.paid': {
        const { data: updated } = await db
          .from('job_invoices')
          .update({
            status: 'paid',
            amount_paid: cents(obj.amount_paid),
            paid_at: new Date().toISOString(),
          })
          .eq('external_ref', stripeInvoiceId)
          .select('id, org_id, number, total, job_id')
          .maybeSingle();

        // Getting paid is the single event most worth being told about.
        if (updated) {
          await db.from('notifications').insert({
            org_id: updated.org_id,
            kind: 'invoice_paid',
            title: `${updated.number} paid`,
            body: `$${Number(updated.total).toFixed(2)} received`,
            href: '/billing',
          });

          await notifyByEmail(
            `Invoice ${updated.number} paid`,
            `$${Number(updated.total).toFixed(2)} has landed for invoice ${updated.number}.`
          );
        }
        break;
      }

      case 'invoice.payment_failed': {
        const { data: failed } = await db
          .from('job_invoices')
          .update({ status: 'overdue' })
          .eq('external_ref', stripeInvoiceId)
          .select('id, org_id, number')
          .maybeSingle();

        if (failed) {
          await db.from('notifications').insert({
            org_id: failed.org_id,
            kind: 'invoice_overdue',
            title: `Payment failed — ${failed.number}`,
            body: 'The card or bank transfer was declined.',
            href: '/billing',
          });
        }
        break;
      }

      // A partial payment still leaves money owed — don't call it paid.
      case 'invoice.updated': {
        const paid = cents(obj.amount_paid);
        const due = cents(obj.amount_due);
        if (paid > 0 && due > 0) {
          await db
            .from('job_invoices')
            .update({ status: 'partial', amount_paid: paid })
            .eq('external_ref', stripeInvoiceId);
        }
        break;
      }

      case 'invoice.voided':
        await db
          .from('job_invoices')
          .update({ status: 'void' })
          .eq('external_ref', stripeInvoiceId);
        break;
    }
  } catch (e) {
    console.error('[stripe/webhook]', (e as Error).message);
    // 500 tells Stripe to retry — better than silently losing a payment.
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
