/**
 * Record a customer's decision on an estimate.
 *
 * Public, reached only with the estimate's own token. Deliberately narrow:
 * the token identifies exactly one estimate, and the only thing this endpoint
 * can do is set that estimate to accepted or declined.
 *
 * A decision is final here. Letting a customer flip their answer repeatedly
 * would mean a job's status could change under Mark's feet after he'd already
 * scheduled crew — so once decided, the page shows the outcome and this
 * endpoint refuses to change it.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { postEmail } from '@/lib/spine/deliverable';

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

  let body: {
    token?: string;
    decision?: string;
    name?: string;
    reason?: string;
    /** Ids of the optional lines they ticked. Never an amount. */
    selected?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { token, decision } = body;
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  if (decision !== 'accepted' && decision !== 'declined') {
    return NextResponse.json({ error: 'Invalid decision' }, { status: 400 });
  }
  if (decision === 'accepted' && !body.name?.trim()) {
    return NextResponse.json({ error: 'A name is required to accept' }, { status: 400 });
  }

  const db = createClient(url, key, { auth: { persistSession: false } });

  try {
    const { data: estimate, error } = await db
      .from('estimates')
      .select('id, status, org_id, job_id, total, base_total, public_token, job:jobs(name, customer_id)')
      .eq('public_token', token)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!estimate) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (['accepted', 'declined'].includes(estimate.status)) {
      return NextResponse.json(
        { error: 'This estimate has already been decided.' },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();

    /**
     * The selection is written before the decision, and the total is read back
     * from the database afterwards.
     *
     * The browser sends which boxes were ticked, never what that came to. The
     * total is recomputed from the lines by a trigger, so the figure recorded
     * against the acceptance is the one the database worked out. This is the
     * same rule the rest of the money already follows.
     */
    let acceptedTotal = Number(estimate.total);
    if (decision === 'accepted') {
      const ids = Array.isArray(body.selected)
        ? (body.selected as unknown[]).filter((x): x is string => typeof x === 'string')
        : [];
      const sel = await db.rpc('accept_estimate_lines', { t: token, chosen: ids });
      if (!sel.error && sel.data != null) acceptedTotal = Number(sel.data);
    }

    const upd = await db
      .from('estimates')
      .update({
        status: decision,
        decided_at: now,
        decided_by_name: body.name?.trim() || null,
        /* The one route the system witnessed itself. Anything accepted by
           email or over the phone gets recorded by hand with the channel and
           the words, because a status alone cannot tell the two apart. */
        decided_via: 'platform',
        decline_reason: decision === 'declined' ? body.reason?.trim() || null : null,
      })
      .eq('id', estimate.id);
    if (upd.error) throw new Error(upd.error.message);

    // Accepting wins the job; declining loses it. The pipeline should reflect
    // reality without anyone moving a card.
    await db
      .from('jobs')
      .update({ status: decision === 'accepted' ? 'won' : 'lost' })
      .eq('id', estimate.job_id);

    const job = one<{ name: string; customer_id: string | null }>(estimate.job);

    /* The name they typed, first name only, because that is how people talk. */
    const whoSaid = body.name?.trim() || '';
    const firstName = whoSaid.split(/\s+/)[0] || 'They';
    const word = 'proposal';

    /*
      A record on the client, because an acceptance is a contract.

      Accepting set a status on the estimate and moved the job to won, both of
      which are working state — the estimate can be superseded, the job moves
      on, and neither is somewhere anybody would look in a year to answer "what
      did they agree to, when, and who said so".

      This writes it onto the customer's own timeline, where their history
      already lives: the amount, the date, the name the person typed, and the
      link to the exact document they were looking at. Written from the same
      request that recorded the decision, so it cannot be true in one place and
      missing in the other.
    */
    /*
      Accepting is what switches the billing on.

      Terms were written down the day they were agreed and sat with
      billing_live false, because agreeing a price and being live are not the
      same thing. Nothing turned that flag, so a client could accept a proposal
      and never be billed for it: the monthly job skips anybody not live, which
      is correct, and nobody was ever making them live.

      The meter starts on the 1st of the month after they say yes. Charging
      from the day somebody accepted means a fractional first invoice, and
      being owed nine days is not worth the first bill they ever see being
      arithmetic.
    */
    if (decision === 'accepted' && job?.customer_id) {
      const nextMonth = new Date();
      nextMonth.setDate(1);
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      await db
        .from('customer_terms')
        .update({
          billing_live: true,
          billing_starts_on: nextMonth.toISOString().slice(0, 10),
        })
        .eq('org_id', estimate.org_id)
        .eq('customer_id', job.customer_id)
        .is('billing_live', false)
        .then(undefined, (e) => console.error('[estimates/decide] billing_live:', e));
    }

    /*
      Last contact was stale by three weeks.

      The client record said "Last contact Sep 1" directly above a history
      entry reading "Sep 23 — Accepted the estimate, signed John Litton".
      Somebody signing your proposal is the strongest contact there is.

      last_contacted_on had exactly one writer: the Log something button. So
      it only ever recorded the contact you remembered to type in, and every
      client who actually did something stayed frozen at whenever you last
      filed a note about them. Clients sorts by this, so the list was ordering
      by your filing habits rather than by who has gone quiet.
    */
    if (job?.customer_id) {
      await db
        .from('customers')
        .update({ last_contacted_on: now.slice(0, 10) })
        .eq('id', job.customer_id)
        .then(undefined, (e) => console.error('[estimates/decide] last_contacted_on:', e));
    }

    if (job?.customer_id) {
      await db.from('customer_notes').insert({
        org_id: estimate.org_id,
        customer_id: job.customer_id,
        job_id: estimate.job_id,
        kind: 'system',
        source: 'estimate',
        direction: 'in',
        happened_on: now.slice(0, 10),
        title:
          decision === 'accepted'
            ? `Accepted: ${job?.name ?? 'proposal'}`
            : `Declined: ${job?.name ?? 'proposal'}`,
        body:
          decision === 'accepted'
            ? [
                `${body.name?.trim() || 'Somebody'} accepted this on ${now.slice(0, 10)}.`,
                `Agreed at ${acceptedTotal.toFixed(2)}.`,
                `Document: /e/${(body.token ?? '').trim()}`,
              ].join('\n')
            : [
                `${body.name?.trim() || 'Somebody'} declined this on ${now.slice(0, 10)}.`,
                body.reason?.trim() ? `Reason given: ${body.reason.trim()}` : null,
                `Document: /e/${(body.token ?? '').trim()}`,
              ].filter(Boolean).join('\n'),
      }).then(undefined, (e) => console.error('[estimates/decide] client record:', e));
    }

    await db.from('notifications').insert({
      org_id: estimate.org_id,
      kind: 'system',
      /*
        Written the way somebody would say it.

        "Estimate accepted — Platform Access & Ongoing Development" is a log
        line. The thing that actually happened is that John said yes, and the
        person reading this has been waiting to hear it. Use his name, say it
        first, and let the record underneath carry the detail.
      */
      title:
        decision === 'accepted'
          ? `Nice! ${firstName} accepted your ${word}`
          : `${firstName} passed on your ${word}`,
      body:
        decision === 'accepted'
          ? `${body.name?.trim()} accepted $${acceptedTotal.toFixed(2)}.`
          : body.reason?.trim() || 'No reason given.',
      href: `/jobs/${estimate.job_id}`,
    });

    if (job?.customer_id) {
      await db.from('customer_notes').insert({
        org_id: estimate.org_id,
        customer_id: job.customer_id,
        job_id: estimate.job_id,
        kind: 'system',
        body:
          decision === 'accepted'
            ? `Accepted the estimate ($${acceptedTotal.toFixed(2)})${body.name?.trim() ? ` — signed ${body.name.trim()}` : ''}.`
            : `Declined the estimate.${body.reason?.trim() ? ` Reason: ${body.reason.trim()}` : ''}`,
      });
    }

    // Tell Mark straight away — a signed estimate is worth an interruption.
    const resendKey = process.env.RESEND_API_KEY;
    const alertTo = process.env.ALERT_EMAIL || 'mikexcalo@gmail.com';
    if (resendKey) {
      try {
        await postEmail(alertTo, {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: process.env.MAIL_FROM || 'CALO&CO <onboarding@resend.dev>',
            to: alertTo,
            subject:
              decision === 'accepted'
                ? `Estimate accepted — ${job?.name ?? ''}`
                : `Estimate declined — ${job?.name ?? ''}`,
            html: `<div style="font-family:-apple-system,sans-serif;font-size:15px;line-height:1.6;">
<p><strong>${job?.name ?? 'Job'}</strong> — ${decision}${body.name?.trim() ? ` by ${body.name.trim()}` : ''}.</p>
${decision === 'accepted' ? `<p>$${acceptedTotal.toFixed(2)}</p>` : ''}
${body.reason?.trim() ? `<p style="color:#555;">${body.reason.trim().replace(/</g, '&lt;')}</p>` : ''}
</div>`,
          }),
        });
      } catch (e) {
        console.error('[estimates/decide] alert email:', e);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[estimates/decide]', (e as Error).message);
    return NextResponse.json({ error: 'Could not record that' }, { status: 500 });
  }
}
