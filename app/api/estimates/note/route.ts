/**
 * A question about a proposal, from the person reading it.
 *
 * The document said "reply to the email this came from", which assumes they
 * still have it, that replying is where they are, and that a thread in a
 * mailbox is a record. It is none of those. A note written on the proposal
 * lands in Feedback next to everything else somebody has said, with the
 * proposal it came from attached.
 *
 * Public by design: the whole point is that the reader has no account. The
 * token is the credential, exactly as it is for reading the document, and it
 * is the only thing that decides which business the note lands in.
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

  let body: { token?: string; body?: string; author?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const text = (body.body ?? '').trim();
  if (!text) return NextResponse.json({ error: 'Say something first.' }, { status: 400 });
  // Capped rather than cut short: losing the end of somebody's question
  // silently is worse than telling them it was too long.
  if (text.length > 4000) {
    return NextResponse.json({ error: 'That is longer than this box takes.' }, { status: 400 });
  }

  const db = createClient(url, key, { auth: { persistSession: false } });

  const { data: est } = await db
    .from('estimates')
    .select('id, org_id, job:jobs(name, customer:customers(name))')
    .eq('public_token', (body.token ?? '').trim())
    .maybeSingle();

  if (!est?.org_id) {
    // Same answer for a wrong token and a missing one.
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  const job = est.job as { name?: string; customer?: { name?: string } | null } | null;
  const who = (body.author ?? '').trim() || job?.customer?.name || 'the customer';

  const { error } = await db.from('feedback').insert({
    org_id: est.org_id,
    kind: 'question',
    body: `${who} asked about "${job?.name ?? 'a proposal'}":\n\n${text}`,
    page: `/e/${(body.token ?? '').trim()}`,
    status: 'open',
  });

  if (error) return NextResponse.json(apiError('estimates/note', error), { status: 500 });
  return NextResponse.json({ ok: true });
}
