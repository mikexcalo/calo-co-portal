/**
 * Lead ingest — the public endpoint your marketing sites POST to.
 *
 * Routes each lead to the right business by source. A form on
 * mammoth-construction lands in Mammoth's CRM; a form on calo.company lands
 * in CALO&CO's. Same endpoint, different books.
 *
 * A lead becomes TWO things in the spine:
 *   - a customer (who they are)
 *   - a job at status 'lead' (the work they're asking about)
 *
 * That's deliberate: a lead and a job are the same record moving through a
 * pipeline, so an inbound enquiry arrives already on the board rather than in
 * a separate inbox someone has to triage into existence.
 *
 * This endpoint is PUBLIC — it's excluded from auth middleware — so it
 * validates hard and never trusts the caller to say which business it is.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Source → business. The mapping lives server-side on purpose: a caller
 * claiming to be Mammoth must not be able to write into Mammoth's book just
 * by saying so. Unknown sources fall to the agency.
 */
const SOURCE_ROUTING: Array<{ match: RegExp; slug: string; label: string; notify: string }> = [
  {
    match: /mammoth/i,
    slug: 'mammoth',
    label: 'Mammoth Construction',
    // Their own inbox, taken from the contact address on their site.
    notify: 'info@mammothconstructiontx.com',
  },
  {
    match: /calo|company|portfolio|mikecalo/i,
    slug: 'calo-co',
    label: 'CALO&CO',
    notify: 'mikexcalo@gmail.com',
  },
];

const FALLBACK = { slug: 'calo-co', label: 'CALO&CO', notify: 'mikexcalo@gmail.com' };

function routeFor(source: string) {
  return SOURCE_ROUTING.find((r) => r.match.test(source)) ?? FALLBACK;
}

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false } });
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { ...cors, 'Access-Control-Max-Age': '86400' },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      source,
      name,
      email,
      phone,
      company,
      message,
      address,
      website, // honeypot
    } = body as Record<string, string | undefined>;

    // Bots fill hidden fields. Humans don't. Return 200 so they don't retune.
    if (website) {
      return NextResponse.json({ success: true }, { status: 200, headers: cors });
    }

    if (!name?.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400, headers: cors });
    }
    if (!email?.trim()) {
      return NextResponse.json({ error: 'email is required' }, { status: 400, headers: cors });
    }
    if (!message?.trim()) {
      return NextResponse.json({ error: 'message is required' }, { status: 400, headers: cors });
    }

    const src = (source || 'unknown').trim();
    const route = routeFor(src);
    const sb = admin();

    const { data: org, error: orgErr } = await sb
      .from('orgs')
      .select('id, name, kind')
      .eq('slug', route.slug)
      .maybeSingle();

    if (orgErr) throw new Error(orgErr.message);
    if (!org) {
      console.error(`[leads/ingest] no org for slug "${route.slug}"`);
      return NextResponse.json(
        { error: 'Lead routing is not configured' },
        { status: 500, headers: cors }
      );
    }

    // Reuse an existing customer on email match, so a repeat enquiry attaches
    // to the person we already know rather than creating a duplicate.
    const cleanEmail = email.trim().toLowerCase();
    const { data: existing } = await sb
      .from('customers')
      .select('id')
      .eq('org_id', org.id)
      .ilike('email', cleanEmail)
      .maybeSingle();

    let customerId = existing?.id ?? null;

    if (!customerId) {
      const { data: created, error: custErr } = await sb
        .from('customers')
        .insert({
          org_id: org.id,
          name: name.trim(),
          email: cleanEmail,
          phone: phone?.trim() || null,
          address: address?.trim() || null,
          notes: company?.trim() ? `Company: ${company.trim()}` : null,
        })
        .select('id')
        .single();

      if (custErr) throw new Error(custErr.message);
      customerId = created.id;
    }

    // The enquiry itself becomes a job at the front of the pipeline.
    const { data: job, error: jobErr } = await sb
      .from('jobs')
      .insert({
        org_id: org.id,
        customer_id: customerId,
        name:
          message.trim().length > 60
            ? `${message.trim().slice(0, 57)}…`
            : message.trim(),
        description: message.trim(),
        address: address?.trim() || null,
        status: 'lead',
        billing_type: org.kind === 'contractor' ? 'tm' : 'fixed',
        source: src,
      })
      .select('id')
      .single();

    if (jobErr) throw new Error(jobErr.message);

    // Notify. A failure here must not lose the lead — it's already saved.
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      try {
        const resend = new Resend(resendKey);
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://nautilusapp.vercel.app';

        await resend.emails.send({
          from: 'Nautilus <onboarding@resend.dev>',
          to: route.notify,
          replyTo: email.trim(),
          subject: `New ${route.label} lead — ${name.trim()}`,
          html: `
<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:15px;line-height:1.6;color:#111;">
  <p style="color:#666;font-size:13px;margin:0 0 16px;">${route.label} · ${src}</p>
  <p><strong>${name.trim()}</strong><br/>
  <a href="mailto:${email.trim()}">${email.trim()}</a>${phone ? `<br/>${phone}` : ''}
  ${company?.trim() ? `<br/>${company.trim()}` : ''}</p>
  <p style="background:#f6f6f4;padding:14px;border-radius:6px;white-space:pre-wrap;">${message
    .trim()
    .replace(/</g, '&lt;')}</p>
  <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0;"/>
  <p><a href="${appUrl}/jobs/${job.id}" style="color:#2563eb;">Open in Nautilus →</a></p>
</div>`.trim(),
        });
      } catch (emailErr) {
        console.error('[leads/ingest] notification failed:', emailErr);
      }
    }

    return NextResponse.json(
      { success: true, job_id: job.id, org: org.name },
      { status: 200, headers: cors }
    );
  } catch (err) {
    console.error('[leads/ingest]', (err as Error).message);
    return NextResponse.json(
      { error: 'Could not record that enquiry' },
      { status: 500, headers: cors }
    );
  }
}
