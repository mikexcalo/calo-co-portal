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

  /*
    Drafts that nobody is told about are drafts that sit there.

    The whole point of building them the night before is that the 1st starts
    with "check these two". That only works if somebody says so.
  */
  if (drafted.length) {
    const { data: orgs } = await db
      .from('customer_terms')
      .select('org_id')
      .eq('billing_live', true);

    for (const orgId of [...new Set((orgs ?? []).map((o) => o.org_id))]) {
      await db.from('notifications').insert({
        org_id: orgId,
        kind: 'system',
        title: `${drafted.length} invoice${drafted.length === 1 ? '' : 's'} ready to check`,
        body:
          `${drafted.join(', ')} built from this month's hours and the agreed fees. ` +
          'Nothing has been sent. Open Invoices, check them, and approve them for the 1st.',
      }).then(undefined, (e) => console.error('[cron/billing] notice:', e));
    }
  }

  /*
    NOTHING APPROVED, AND THE MONTH IS ENDING.

    The workflow is: work happens through the month, the run drafts on the last
    day, somebody approves, and it goes out on the 1st. Approving is the only
    human step and it is the one thing nothing asked for.

    The notice above only fires when this run DRAFTED something. On a month
    where the drafts already exist — which is every month after the first, and
    was September — it drafted nothing, so it said nothing, and two correct
    invoices would have sat unapproved through the 1st with no word from
    anybody.

    It fired from the 26th, every day, which is five or six identical
    notifications for a decision that is deliberately made at the end of the
    month. Work is still being billed on the 26th — a reminder to approve an
    invoice that is not finished yet is not a reminder, it is noise, and a
    thing that nags before you could act teaches you to ignore it by the time
    you could.

    Last day only. That is when the drafting happens and when the approving
    actually happens, so it asks once, on the day it is a real question.
  */
  if (isLastDayOfMonth(today)) {
    const { data: waiting } = await db
      .from('job_invoices')
      .select('id, org_id, number, total')
      .eq('status', 'draft')
      .is('send_on', null);

    const byOrg = new Map<string, { n: number; total: number; numbers: string[] }>();
    for (const inv of waiting ?? []) {
      const e = byOrg.get(inv.org_id) ?? { n: 0, total: 0, numbers: [] };
      e.n += 1;
      e.total += Number(inv.total ?? 0);
      if (e.numbers.length < 4) e.numbers.push(inv.number);
      byOrg.set(inv.org_id, e);
    }

    for (const [orgId, e] of byOrg) {
      await db.from('notifications').insert({
        org_id: orgId,
        kind: 'system',
        title: `${e.n} invoice${e.n === 1 ? '' : 's'} ready for the 1st`,
        body:
          `${e.numbers.join(', ')} — $${e.total.toFixed(2)} in total. ` +
          'Last day of the month, so this is the moment to check the hours are ' +
          'all on and approve. Anything not approved simply waits.',
        href: '/billing',
      }).then(undefined, (err) => console.error('[cron/billing] approve notice:', err));
    }
  }

  /* Say what happened even when nothing did. A run that only reports its
     successes cannot be told apart from one that never fired. */
  console.log('[cron/billing]', JSON.stringify({ ranOn: todayStr, drafted, sent }));
  return NextResponse.json({ ok: true, drafted, sent, ranOn: todayStr });
}
