/**
 * A client replies, and it files itself.
 *
 * This is the half that was missing. Sending worked; nothing ever came back, so
 * the stage engine could move a company to Reached and never to Talking, and
 * "they replied" — the single most useful fact a pipeline holds — could only be
 * recorded by somebody typing it.
 *
 * WHY NOT GMAIL SYNC
 *
 * gmail.readonly is a Google restricted scope: a CASA security assessment by an
 * approved lab, renewed annually, weeks of review and thousands of dollars, or
 * else testing mode with a hundred hand-listed users each shown an unverified
 * app warning. That is fine for one person and a wall the day a client needs
 * it. Reply routing does the same job for one MX record, and it works the same
 * whether the client is on Gmail, Outlook or anything else.
 *
 * HOW IT ARRIVES
 *
 * Mail we send carries Reply-To: reply+<key>@in.<domain>. Resend takes delivery
 * for that subdomain and posts here. The key names the company; nothing else in
 * the message is trusted to.
 *
 * WHY THE SIGNATURE IS CHECKED
 *
 * This endpoint writes to the database and is necessarily public. Without a
 * signature, anybody who has ever received one of these emails knows the URL
 * shape and a valid key, and could post invented conversations into the CRM.
 * Svix signs every delivery; unsigned or badly signed posts are refused.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'crypto';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Svix signature, verified by hand rather than by pulling in the library.
 *
 * The scheme is small and stable: sign "<id>.<timestamp>.<body>" with the
 * secret, base64, compare in constant time. The timestamp is checked so a
 * captured delivery cannot be replayed a week later.
 */
function signed(req: NextRequest, raw: string, secret: string): boolean {
  const id = req.headers.get('svix-id');
  const ts = req.headers.get('svix-timestamp');
  const sig = req.headers.get('svix-signature');
  if (!id || !ts || !sig) return false;

  const age = Math.abs(Date.now() / 1000 - Number(ts));
  if (!Number.isFinite(age) || age > 300) return false;

  // whsec_ prefixed, base64 after it.
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = createHmac('sha256', key).update(`${id}.${ts}.${raw}`).digest('base64');

  // The header holds one or more space separated "v1,<sig>" pairs.
  return sig.split(' ').some((part) => {
    const value = part.split(',')[1];
    if (!value) return false;
    const a = Buffer.from(value);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

/** reply+<key>@in.example.com, from wherever in the recipients it landed. */
function keyFrom(to: unknown): string | null {
  const list = Array.isArray(to) ? to : [to];
  for (const entry of list) {
    const address = typeof entry === 'string' ? entry : (entry as { address?: string })?.address;
    const m = address?.match(/reply\+([a-z0-9]+)@/i);
    if (m) return m[1].toLowerCase();
  }
  return null;
}

/**
 * The reply, without the quoted thread underneath it.
 *
 * Every mail client appends the message being replied to, so filing the raw
 * body would store the same conversation again on every exchange and the note
 * would grow until nobody reads it. These are the markers the common clients
 * use; anything unrecognised is left whole, because losing the reply is worse
 * than keeping the quote.
 */
function justTheReply(text: string): string {
  const cuts = [
    /^On .+ wrote:$/m,
    /^-{2,}\s*Original Message\s*-{2,}$/im,
    /^_{10,}$/m,
    /^From:\s.+$/m,
    /^Sent from my /m,
  ];
  let end = text.length;
  for (const re of cuts) {
    const m = text.match(re);
    if (m?.index !== undefined && m.index < end) end = m.index;
  }
  const body = text.slice(0, end).trim();
  return body.length > 0 ? body : text.trim();
}

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const secret = process.env.RESEND_WEBHOOK_SECRET;

  if (!url || !service) {
    return NextResponse.json({ error: 'Not configured.' }, { status: 500 });
  }
  /**
   * No secret means no verification, and an unverified writer is worse than a
   * missing feature. Refused rather than trusted.
   */
  if (!secret) {
    console.error('[inbound] RESEND_WEBHOOK_SECRET missing; refusing to write');
    return NextResponse.json({ error: 'Not configured.' }, { status: 500 });
  }

  const raw = await req.text();
  if (!signed(req, raw, secret)) {
    return NextResponse.json({ error: 'Bad signature.' }, { status: 401 });
  }

  let event: { type?: string; data?: Record<string, unknown> };
  try { event = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }
  if (event.type !== 'email.received') return NextResponse.json({ ok: true, ignored: event.type });

  const data = event.data ?? {};
  const key = keyFrom(data.to);
  if (!key) {
    // Mail to the subdomain that names no company. Acknowledged so Resend does
    // not retry, logged so a misrouted address is visible rather than silent.
    console.warn('[inbound] no reply key in recipients');
    return NextResponse.json({ ok: true, matched: false });
  }

  /**
   * Service role, because this request has no session.
   *
   * It arrives from a mail server, so there is no signed-in user for RLS to
   * scope by. Every write below is pinned to the org that owns the matched
   * company rather than to anything the message claimed.
   */
  const db = createClient(url, service, { auth: { persistSession: false } });

  const { data: customer } = await db
    .from('customers')
    .select('id, org_id, name, stage')
    .eq('reply_key', key)
    .maybeSingle();

  if (!customer) {
    console.warn('[inbound] unknown reply key');
    return NextResponse.json({ ok: true, matched: false });
  }

  const from = (data.from as { address?: string } | string | undefined);
  const sender = typeof from === 'string' ? from : from?.address ?? 'them';
  const subject = (data.subject as string | undefined) ?? 'Reply';
  const text = (data.text as string | undefined) ?? '';

  const { error } = await db.from('customer_notes').insert({
    org_id: customer.org_id,
    customer_id: customer.id,
    kind: 'email',
    direction: 'in',
    body: `${subject}\n\nFrom ${sender}\n\n${justTheReply(text)}`,
    happened_on: new Date().toISOString().slice(0, 10),
  });

  if (error) {
    // 500 so Resend retries. Losing a client's reply is not acceptable.
    console.error('[inbound] insert failed', error.message);
    return NextResponse.json({ error: 'Could not file it.' }, { status: 500 });
  }

  /**
   * Contact is contact.
   *
   * The stage trigger on customer_notes already moves them to Talking; this is
   * the other half, and it is what the whole audit was about: a fact recorded
   * without anybody typing it.
   */
  await db
    .from('customers')
    .update({ last_contacted_on: new Date().toISOString().slice(0, 10), awaiting_reply_since: null })
    .eq('id', customer.id);

  return NextResponse.json({ ok: true, filed: customer.name });
}
