/**
 * "I've sent it."
 *
 * There is no Venmo or PayPal integration and there may never be one, so
 * nothing tells this system when money actually arrives. Until now the only
 * person who could say so was Mike, which means every payment needed him to
 * notice a message from a payments app, remember which invoice it was, and go
 * and tick it.
 *
 * The person who pressed send in their banking app already knows. This lets
 * them say so, on the invoice, the moment they do it.
 *
 * It does NOT mark the invoice paid. A customer saying they have sent money
 * and money having arrived are different facts, and an invoice that marks
 * itself paid on somebody's word is one that quietly stops chasing people who
 * forgot. It records the claim and tells Mike; he confirms.
 */

import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { apiError } from '@/lib/spine/errors';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'Server is not configured' }, { status: 500 });
  }

  let body: { token?: string; via?: string; note?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const token = (body.token ?? '').trim();
  if (!token) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const db = createClient(url, key, { auth: { persistSession: false } });

  const { data: inv } = await db
    .from('job_invoices')
    .select('id, org_id, number, job:jobs(customer:customers(name))')
    .eq('public_token', token)
    .maybeSingle();

  if (!inv?.org_id) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const job = inv.job as { customer?: { name?: string } | null } | null;
  const who = job?.customer?.name ?? 'The customer';
  const via = (body.via ?? '').trim();
  const note = (body.note ?? '').trim();

  const said = [`${who} says they've paid ${inv.number}`, via ? `by ${via}` : null]
    .filter(Boolean)
    .join(' ');

  /* On Home as well as in feedback: money arriving is the point of all this. */
  await db.from('notifications').insert({
    org_id: inv.org_id,
    kind: 'system',
    title: `${who.split(/\s+/)[0]} says they've paid ${inv.number}`,
    body: 'Check it landed, then tick it on the invoice.',
  }).then(undefined, () => {});

  const { error } = await db.from('feedback').insert({
    org_id: inv.org_id,
    kind: 'payment',
    body: `${said}.${note ? `\n\n"${note}"` : ''}\n\nNot marked paid. Check it landed, then tick it on the invoice.`,
    page: '/billing',
    status: 'open',
  });

  if (error) return NextResponse.json(apiError('invoices/said-paid', error), { status: 500 });

  // Stamped on the invoice as well, so the claim is visible where the money
  // is rather than only in a feed somebody has to be looking at.
  await db.from('job_invoices').update({ payment_note: said }).eq('id', inv.id);

  return NextResponse.json({ ok: true });
}
