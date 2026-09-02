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
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

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
  if (error) return NextResponse.json({ error: error.message }, { status: 502 });

  const rows = (data ?? []) as Row[];
  if (!rows.length) return NextResponse.json({ sent: 0, message: 'Nothing to chase.' });

  const { data: org } = await supabase.from('orgs').select('name').eq('id', rows[0].org_id).maybeSingle();
  const resendKey = process.env.RESEND_API_KEY;
  const site = process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.get('host')}`;

  let sent = 0;

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

    if (!resendKey) { sent += 1; continue; }

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

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || 'CALO&CO <onboarding@resend.dev>',
        to: r.customer_email,
        subject,
        html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.65;color:#111;max-width:520px;">
${message}
${link ? `<p><a href="${link}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:13px 24px;border-radius:8px;font-weight:600;">${isQuote ? 'Open the quote' : 'Open the invoice'}</a></p>` : ''}
<p style="color:#666;font-size:13px;">${org?.name ?? ''}</p>
</div>`,
      }),
    });
    if (res.ok) sent += 1;
  }

  return NextResponse.json({
    sent,
    message: resendKey
      ? `Sent ${sent} ${sent === 1 ? 'reminder' : 'reminders'}.`
      : 'Email is not switched on, so these were marked as chased but nothing was sent.',
  });
}
