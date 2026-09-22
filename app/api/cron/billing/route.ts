/**
 * The last day of the month, and the first.
 *
 * Two jobs that have to happen on a calendar rather than when somebody
 * remembers:
 *
 *   On the LAST day of the month, every client with agreed terms gets a draft
 *   invoice built. Not sent. Sitting there, so the morning of the 1st starts
 *   with "check these two" instead of "build these two".
 *
 *   On any day, anything Mike approved with a send date of today or earlier
 *   goes out. That is what lets him sign off on the 30th for a send on the 1st
 *   without being at a desk when it happens.
 *
 * Drafting never sends and sending never drafts. A run that half-works leaves
 * drafts a person can read rather than mail a customer should not have had.
 */

import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

function isLastDayOfMonth(d: Date): boolean {
  const next = new Date(d);
  next.setDate(d.getDate() + 1);
  return next.getMonth() !== d.getMonth();
}

export async function GET(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'Server is not configured' }, { status: 500 });
  }

  /*
    Vercel signs its own cron calls. Anything else has to carry the secret,
    because this creates invoices and sends email, and an endpoint that does
    both cannot be open to whoever finds the URL.
  */
  const secret = process.env.CRON_SECRET;
  const fromVercel = req.headers.get('user-agent')?.includes('vercel-cron');
  const authed = req.headers.get('authorization') === `Bearer ${secret}`;
  if (!fromVercel && !(secret && authed)) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  const db = createClient(url, key, { auth: { persistSession: false } });
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const drafted: string[] = [];
  const sent: string[] = [];

  // ---- The last day of the month: build what next month starts with. ------
  if (isLastDayOfMonth(today)) {
    const { data: terms } = await db
      .from('customer_terms')
      .select('org_id, customer_id, billing_live');

    for (const t of terms ?? []) {
      // Terms exist before billing does. Switching a client on is a decision
      // somebody makes once, and until they do this leaves them alone.
      if (t.billing_live === false) continue;

      const { data: job } = await db
        .from('jobs')
        .select('id')
        .eq('org_id', t.org_id)
        .eq('customer_id', t.customer_id)
        .not('status', 'in', '(closed,lost)')
        .order('created_at')
        .limit(1)
        .maybeSingle();
      if (!job?.id) continue;

      // Never twice for the same month, however many times this runs.
      const monthStart = `${todayStr.slice(0, 7)}-01`;
      const { data: already } = await db
        .from('job_invoices')
        .select('id')
        .eq('job_id', job.id)
        .gte('issued_on', monthStart)
        .limit(1)
        .maybeSingle();
      if (already) continue;

      const res = await fetch(`${req.nextUrl.origin}/api/invoices/draft-monthly`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${secret}` },
        body: JSON.stringify({ orgId: t.org_id, jobId: job.id }),
      }).then((r) => r.json()).catch(() => null);

      if (res?.number) drafted.push(res.number);
    }
  }

  // ---- Any day: anything due to go out today, goes out. -------------------
  const { data: due } = await db
    .from('job_invoices')
    .select('id, number, public_token')
    .is('sent_at', null)
    .not('send_on', 'is', null)
    .lte('send_on', todayStr);

  for (const inv of due ?? []) {
    const r = await fetch(`${req.nextUrl.origin}/api/invoices/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authorization: `Bearer ${secret}` },
      body: JSON.stringify({ invoiceId: inv.id, fromCron: true }),
    }).catch(() => null);
    if (r?.ok) sent.push(inv.number);
  }

  return NextResponse.json({ ok: true, drafted, sent, ranOn: todayStr });
}
