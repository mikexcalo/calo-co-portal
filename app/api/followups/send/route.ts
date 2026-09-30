/**
 * Chasing quiet quotes and late invoices.
 *
 * Two places money quietly goes missing, both already visible on a screen, and
 * a screen only helps somebody who opens it.
 *
 * DELIBERATELY CONSERVATIVE
 *
 * A quote gets one nudge and never a sequence. A second reminder about a quote
 * reads as needing the work, which is the wrong position to be negotiating
 * from, and the view enforces that rather than this route.
 *
 * An invoice gets one a week, because that one is owed and the tone can be
 * matter of fact rather than hopeful.
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/spine/errors';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { postEmail, sendingAllowed, fromAs, SEND_NOT_GRANTED } from '@/lib/spine/deliverable';
import { PRODUCT } from '@/lib/brand';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface Row {
  kind: 'estimate' | 'invoice';
  id: string;
  org_id: string;
  token: string | null;
  customer_name: string | null;
  customer_email: string;
  job_name: string | null;
  amount: number;
  days: number;
}

const money = (n: number) =>
  `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return NextResponse.json({ error: 'Not configured.' }, { status: 500 });

  const store = cookies();
  const supabase = createServerClient(url, anon, {
    cookies: { get: (n: string) => store.get(n)?.value, set: () => {}, remove: () => {} },
  });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  let body: { id?: string } = {};
  try { body = await req.json(); } catch { /* everything due is the default */ }

  let q = supabase.from('follow_ups').select('*');
  if (body.id) q = q.eq('id', body.id);
  const { data, error } = await q;
  if (error) return NextResponse.json(apiError('followups/send', error), { status: 502 });

  const rows = (data ?? []) as Row[];
  if (!rows.length) return NextResponse.json({ sent: 0, message: 'Nothing to chase.' });

  /*
    Asked before anything is written, not after.

    The stamp below deliberately goes in before the send, so a crash cannot
    chase the same person twice. A refusal is not a crash: nothing left the
    building, and an invoice marked as chased when no reminder went is worse
    than no reminder at all, because the screen then says it was handled.
    postEmail() refuses the same call a second time; this one exists so the
    refusal happens before the record says otherwise.
  */
  if (!(await sendingAllowed())) {
    return NextResponse.json({ error: SEND_NOT_GRANTED, refused: true }, { status: 403 });
  }

  const { data: org } = await supabase
    .from('orgs')
    .select('name, settings')
    .eq('id', rows[0].org_id)
    .maybeSingle();
  const business = (org as { name?: string } | null)?.name ?? null;
  /* Where a customer's reply should land: theirs, not ours. */
  const replyTo =
    (((org as { settings?: Record<string, unknown> } | null)?.settings?.email as string) ?? '').trim() ||
    undefined;
  const resendKey = process.env.RESEND_API_KEY;
  const site = process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.get('host')}`;

  let sent = 0;
  let skipped = 0;
  let failure: string | null = null;

  for (const r of rows) {
    const first = (r.customer_name ?? '').split(' ')[0] || 'Hello';
    const link = r.token ? `${site}/${r.kind === 'estimate' ? 'e' : 'i'}/${r.token}` : null;

    /**
     * Stamped before sending, same as the review asks.
     *
     * A crash between sending and recording would chase the same person again
     * tomorrow, and chasing twice about money is how a polite nudge turns into
     * a bad conversation.
     */
    const table = r.kind === 'estimate' ? 'estimates' : 'job_invoices';
    const stamp = await supabase.from(table).update({ nudged_at: new Date().toISOString() }).eq('id', r.id);
    if (stamp.error) continue;

    /* No mail credentials is not a send. It used to count as one, so a
       machine with email switched off reported reminders that never left. */
    if (!resendKey) continue;

    const isQuote = r.kind === 'estimate';
    const subject = isQuote
      ? `Still thinking about ${r.job_name ?? 'the quote'}?`
      : `Invoice for ${r.job_name ?? 'your job'}`;

    const message = isQuote
      ? `<p>${first},</p>
<p>Just checking you saw the quote for ${r.job_name ?? 'the work'}. No rush, and no obligation. If the number is not right or something has changed, tell me and we can look at it again.</p>`
      : `<p>${first},</p>
<p>The invoice for ${r.job_name ?? 'your job'} came due ${r.days} ${r.days === 1 ? 'day' : 'days'} ago. ${money(Number(r.amount))} outstanding.</p>
<p>If it is already on its way, ignore this. If something is holding it up, let me know.</p>`;

    const res = await postEmail(r.customer_email, {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromAs(business, PRODUCT),
        ...(replyTo ? { reply_to: replyTo } : {}),
        to: r.customer_email,
        subject,
        html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.65;color:#111;max-width:520px;">
${message}
${link ? `<p><a href="${link}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:13px 24px;border-radius:8px;font-weight:600;">${isQuote ? 'Open the quote' : 'Open the invoice'}</a></p>` : ''}
<p style="color:#666;font-size:13px;">${business ?? ''}</p>
</div>`,
      }),
    }, { table: r.kind === 'estimate' ? 'estimates' : 'job_invoices', id: r.id });
    /*
      A skipped send is not a sent one, and the message has to say which.

      postEmail() answers ok for a reserved test address, on purpose, so the
      code around it does not have to branch. The sentence a person reads
      does: "Sent 1 reminder" about a demo customer at example.com is the
      product telling somebody an email arrived that never left.
    */
    const body = (await res.json().catch(() => null)) as
      | { skipped?: boolean; message?: string; error?: string; name?: string }
      | null;

    if (!res.ok) {
      /*
        Say what the mail service said.

        This used to `continue` and count nothing, so a rejected send came back
        as "Nothing was sent." with no reason anywhere, on a screen and in a
        log. Whatever Resend refuses it refuses for a knowable reason, and the
        person pressing the button is the one who can act on it.
      */
      const why = body?.message || body?.error || `the mail service answered ${res.status}`;
      console.error('[followups/send]', res.status, why);
      if (!failure) failure = why;
      continue;
    }

    if (body?.skipped) skipped += 1;
    else sent += 1;
  }

  const said =
    !resendKey
      ? 'Email is not switched on, so these were marked as chased but nothing was sent.'
      : sent
        ? `Reminder sent${sent > 1 ? ` to ${sent}` : ''}.`
        : skipped
          ? `Marked as chased. ${skipped === 1 ? 'That address is' : 'Those addresses are'} a reserved test address, so nothing was sent.`
          : failure
            ? `Nothing was sent: ${failure}`
            : 'Nothing was sent.';

  return NextResponse.json({ sent, skipped, message: said });
}
