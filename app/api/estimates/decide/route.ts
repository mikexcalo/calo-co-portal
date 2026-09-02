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

    await db.from('notifications').insert({
      org_id: estimate.org_id,
      kind: 'system',
      title:
        decision === 'accepted'
          ? `Estimate accepted — ${job?.name ?? 'job'}`
          : `Estimate declined — ${job?.name ?? 'job'}`,
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
        await fetch('https://api.resend.com/emails', {
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
