/**
 * Get a payment link for an invoice the caller has been billed.
 *
 * Separate from /api/invoices/send, which is the agency pushing an invoice
 * out. This is the client pulling up a way to pay one they can already see.
 *
 * If the invoice was sent through Stripe it already has a hosted page, so we
 * return that. If Stripe isn't configured, it says so plainly rather than
 * dead-ending on a button that does nothing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let invoiceId: string | undefined;
  try {
    ({ invoiceId } = await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!invoiceId) {
    return NextResponse.json({ error: 'invoiceId is required' }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const stripeKey = process.env.STRIPE_SECRET_KEY;

  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Server is not configured' }, { status: 500 });
  }

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  try {
    const { data: invoice, error } = await db
      .from('job_invoices')
      .select('id, number, status, external_ref, total, amount_paid')
      .eq('id', invoiceId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    if (invoice.status === 'paid') {
      return NextResponse.json({ message: 'This invoice is already paid.' });
    }

    if (!stripeKey) {
      return NextResponse.json({
        message:
          'Online payment is not switched on yet. Contact your account manager to settle this invoice.',
      });
    }

    if (!invoice.external_ref) {
      return NextResponse.json({
        message:
          'This invoice has not been issued for online payment yet. Ask for it to be sent.',
      });
    }

    // Stripe already hosts a payment page for a sent invoice — reuse it
    // rather than creating a second way to pay the same thing.
    const res = await fetch(
      `https://api.stripe.com/v1/invoices/${invoice.external_ref}`,
      { headers: { Authorization: `Bearer ${stripeKey}` } }
    );
    const payload = await res.json();

    if (!res.ok) {
      throw new Error(payload?.error?.message ?? `Stripe ${res.status}`);
    }

    return NextResponse.json({
      url: payload.hosted_invoice_url ?? null,
      pdf: payload.invoice_pdf ?? null,
      message: payload.hosted_invoice_url ? undefined : 'No payment page is available yet.',
    });
  } catch (e) {
    const msg = (e as Error).message;
    console.error('[invoices/pay-link]', msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
