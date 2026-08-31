/**
 * Send an invoice through Stripe.
 *
 * Replaces the old approach of printing your Zelle/Venmo handles on a PDF and
 * hoping. Stripe emails a hosted invoice, the customer pays by card or bank
 * transfer, and it marks itself paid via webhook — so "paid" stops being a
 * button someone remembers to press.
 *
 * Uses Stripe's REST API directly rather than the SDK: it's four endpoints,
 * and it keeps a dependency out of the build.
 *
 * Requires STRIPE_SECRET_KEY. Without it this route returns 501 and the rest
 * of the app is unaffected — invoices can still be marked paid by hand.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Refuse to charge through the platform's Stripe account on behalf of a
 * business that does not own it.
 *
 * The UI already hides the option, but a guard that only lives in the browser
 * is not a guard. The failure this prevents is money arriving in the wrong
 * bank account, which nobody discovers until a contractor asks where his
 * payment went — so it is checked again here, against the invoice's own
 * business, where it cannot be skipped.
 */
async function stripeAllowedFor(
  db: SupabaseClient,
  orgId: string | null | undefined
): Promise<boolean> {
  if (!orgId) return false;
  const owner = (process.env.STRIPE_OWNER_ORG || 'calo-co').trim();
  const { data } = await db.from('orgs').select('slug').eq('id', orgId).maybeSingle();
  return (data as { slug?: string } | null)?.slug === owner;
}


const STRIPE_API = 'https://api.stripe.com/v1';

/** Stripe wants form-encoded bodies, including for nested fields. */
function form(params: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') p.append(k, String(v));
  }
  return p.toString();
}

async function stripe(
  key: string,
  path: string,
  body?: Record<string, string | number | undefined>
) {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body ? form(body) : undefined,
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message || `Stripe ${res.status}`);
  }
  return json;
}

export async function POST(req: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json(
      {
        error:
          'Stripe is not configured. Add STRIPE_SECRET_KEY to enable sending invoices for payment.',
      },
      { status: 501 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY is required to send invoices.' },
      { status: 500 }
    );
  }

  let invoiceId: string;
  try {
    ({ invoiceId } = await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!invoiceId) {
    return NextResponse.json({ error: 'invoiceId is required' }, { status: 400 });
  }

  // Service-role client: this runs server-side and needs to read the invoice
  // and its customer regardless of the caller's session.
  const db = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  try {
    const { data: invoice, error: invErr } = await db
      .from('job_invoices')
      .select('*, job:jobs(id, name, customer_id)')
      .eq('id', invoiceId)
      .maybeSingle();

    if (invErr) throw new Error(invErr.message);
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    if (!(await stripeAllowedFor(db, invoice.org_id))) {
      return NextResponse.json(
        {
          error:
            "Card payments aren't connected to this business yet. Sending through Stripe would put the money in somebody else's account, so it's blocked. Email the invoice as a link instead.",
        },
        { status: 403 }
      );
    }
    if (invoice.status === 'void') {
      return NextResponse.json({ error: 'Cannot send a voided invoice' }, { status: 400 });
    }
    if (invoice.external_ref) {
      return NextResponse.json(
        { error: 'This invoice has already been sent to Stripe.' },
        { status: 409 }
      );
    }

    const job = invoice.job as { id: string; name: string; customer_id: string | null };

    const { data: customer, error: custErr } = await db
      .from('customers')
      .select('id, name, email')
      .eq('id', job?.customer_id ?? '')
      .maybeSingle();

    if (custErr) throw new Error(custErr.message);
    if (!customer?.email) {
      return NextResponse.json(
        { error: 'The customer needs an email address before an invoice can be sent.' },
        { status: 400 }
      );
    }

    const { data: lines, error: lineErr } = await db
      .from('job_invoice_lines')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('position');

    if (lineErr) throw new Error(lineErr.message);
    if (!lines?.length) {
      return NextResponse.json({ error: 'Invoice has no lines' }, { status: 400 });
    }

    // 1. Find or create the Stripe customer
    const existing = await stripe(
      stripeKey,
      `/customers/search?query=${encodeURIComponent(`email:'${customer.email}'`)}`
    );
    const stripeCustomerId =
      existing.data?.[0]?.id ??
      (await stripe(stripeKey, '/customers', {
        email: customer.email,
        name: customer.name,
      })).id;

    // 2. Create the draft invoice
    const stripeInvoice = await stripe(stripeKey, '/invoices', {
      customer: stripeCustomerId,
      collection_method: 'send_invoice',
      days_until_due: daysUntil(invoice.due_on),
      description: job?.name ? `${job.name} — ${invoice.number}` : invoice.number,
      'metadata[nautilus_invoice_id]': invoiceId,
      auto_advance: 'false',
    });

    // 3. Attach the lines. Amounts are in cents — Stripe rejects decimals.
    for (const line of lines) {
      await stripe(stripeKey, '/invoiceitems', {
        customer: stripeCustomerId,
        invoice: stripeInvoice.id,
        amount: Math.round(Number(line.total) * 100),
        currency: 'usd',
        description: line.description,
      });
    }

    // 4. Finalize and send
    await stripe(stripeKey, `/invoices/${stripeInvoice.id}/finalize`, {});
    const sent = await stripe(stripeKey, `/invoices/${stripeInvoice.id}/send`, {});

    const { error: updErr } = await db
      .from('job_invoices')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        external_ref: stripeInvoice.id,
      })
      .eq('id', invoiceId);

    if (updErr) throw new Error(updErr.message);

    return NextResponse.json({
      ok: true,
      stripeInvoiceId: stripeInvoice.id,
      hostedUrl: sent.hosted_invoice_url ?? null,
      pdfUrl: sent.invoice_pdf ?? null,
    });
  } catch (e) {
    const msg = (e as Error).message;
    console.error('[invoices/send]', msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

function daysUntil(due: string | null): number {
  if (!due) return 30;
  const days = Math.ceil((new Date(due).getTime() - Date.now()) / 86_400_000);
  return Math.max(1, Math.min(days, 365));
}
