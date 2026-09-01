/**
 * Sending the review ask.
 *
 * Called by the daily pass, and by hand from the marketing screen when
 * somebody wants to send one now rather than wait for tomorrow.
 *
 * The judgement is not in this file. review_due decides who is worth asking,
 * including the rule that matters most: nobody with money outstanding. Asking
 * a customer for five stars while chasing their invoice is how you get one
 * star and lose the invoice, and it is the mistake automated review tools make
 * constantly.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface Due {
  job_id: string;
  org_id: string;
  customer_id: string | null;
  job_name: string;
  customer_name: string | null;
  customer_email: string;
  review_link: string;
}

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

  let body: { jobId?: string } = {};
  try { body = await req.json(); } catch { /* sending everything due is the default */ }

  let q = supabase.from('review_due').select('*');
  if (body.jobId) q = q.eq('job_id', body.jobId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 502 });

  const due = (data ?? []) as Due[];
  if (!due.length) return NextResponse.json({ sent: 0, message: 'Nobody to ask right now.' });

  const { data: org } = await supabase.from('orgs').select('name').eq('id', due[0].org_id).maybeSingle();
  const resendKey = process.env.RESEND_API_KEY;
  const site = process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.get('host')}`;

  let sent = 0;
  const failures: string[] = [];

  for (const d of due) {
    /**
     * The row is written before the email goes out.
     *
     * If it went the other way round, a crash between sending and recording
     * would ask the same customer again tomorrow, and the day after. Asking
     * twice is worse than not asking: it reads as automated, which is the one
     * thing a personal request must not.
     */
    const ins = await supabase
      .from('review_requests')
      .insert({
        org_id: d.org_id,
        job_id: d.job_id,
        customer_id: d.customer_id,
        sent_to: d.customer_email,
        sent_at: new Date().toISOString(),
      })
      .select('token')
      .single();

    if (ins.error) { failures.push(d.customer_name ?? d.job_name); continue; }

    if (!resendKey) { sent += 1; continue; }

    const first = (d.customer_name ?? '').split(' ')[0] || 'Hello';
    const link = `${site}/r/${ins.data.token}`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || 'CALO&CO <onboarding@resend.dev>',
        to: d.customer_email,
        // No company name in the subject: this should read like a person
        // wrote it, because a person nearly did.
        subject: `Quick favour after ${d.job_name}`,
        html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.65;color:#111;max-width:520px;">
<p>${first},</p>
<p>Thanks again for having us out for ${d.job_name}. If you were happy with how it went, would you mind leaving a review? It takes about a minute and it genuinely decides whether the next person finds us.</p>
<p><a href="${link}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:13px 24px;border-radius:8px;font-weight:600;">Leave a review</a></p>
<p style="color:#666;font-size:13px;margin-top:22px;">And if anything was not right, reply to this instead and we will sort it out.</p>
<p style="color:#666;font-size:13px;">${org?.name ?? ''}</p>
</div>`,
      }),
    });

    if (res.ok) sent += 1;
    else failures.push(d.customer_name ?? d.job_name);
  }

  return NextResponse.json({
    sent,
    failures,
    message: resendKey
      ? `Asked ${sent} ${sent === 1 ? 'customer' : 'customers'}.`
      : 'Email is not switched on, so the requests were recorded but nothing was sent.',
  });
}
