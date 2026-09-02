/**
 * The update you owe a client, written from what you already recorded.
 *
 * Clients do not leave because the work is bad. They leave because they stop
 * knowing what is happening, and then a small doubt has nowhere to go. The
 * agencies that keep clients are the ones that send something on a Friday.
 *
 * Nobody does it, because writing it means reconstructing the week from
 * memory. All of it is already here: the brief says where things stand, the
 * schedule says what moved, the invoices say what was billed. This assembles
 * that into something a person would actually send.
 *
 * WHAT IT WILL NOT SAY
 *
 * Anything internal. The brief's stuck line often names the client as the
 * blocker, and "waiting on you since the first" is true, useful to you, and
 * not what you send. It gets turned into a request rather than an accusation,
 * or left out.
 *
 * And nothing is sent without being read. It comes back as a draft.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MODEL = 'claude-haiku-4-5';
const INPUT_PER_MTOK = 1.0;
const OUTPUT_PER_MTOK = 5.0;

const SCHEMA = {
  type: 'object' as const,
  properties: {
    subject: {
      type: 'string' as const,
      description: 'A subject line a person would open. Names the work, not the word update.',
    },
    body: {
      type: 'string' as const,
      description:
        'The email. Plain paragraphs, no headings, no bullet lists unless there are genuinely three or more discrete items. Six sentences is usually plenty.',
    },
    asks: {
      type: 'array' as const,
      description:
        'What you need from them, phrased as a request rather than a complaint. Empty if nothing.',
      items: { type: 'string' as const },
    },
    withheld: {
      type: 'array' as const,
      description:
        'Anything in the material you deliberately left out because it is internal. Named so the person sending can disagree.',
      items: { type: 'string' as const },
    },
  },
  required: ['subject', 'body', 'asks', 'withheld'],
};

const SYSTEM = `You write the short update an agency sends a client to keep them confident.

Write as the person who did the work, to somebody who is paying for it and has not thought about it since the last conversation.

Rules:

Lead with what moved. Not what you plan to do, not a summary of the engagement, the thing that is different since last time.

Say what is next and roughly when. Vagueness about timing is what makes a client start chasing.

If you need something from them, ask plainly and say what it unblocks. Never imply they are late. "The organizational meeting needs directors named before it can happen" is a fact about the work. "We are still waiting on you" is a complaint, and it costs more than the delay.

Leave out anything internal. Margin, what the work cost you, your own doubts, notes to yourself. If you drop something for this reason, list it in withheld so the sender can put it back if they disagree.

Six sentences is usually enough. No headings, no bullet lists unless there are three or more genuinely discrete items. No em-dashes. American spelling. Do not open with a pleasantry about hoping they are well.`;

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return NextResponse.json({ error: 'Not configured.' }, { status: 500 });

  let body: { customerId?: string; send?: boolean; subject?: string; text?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }
  if (!body.customerId) return NextResponse.json({ error: 'Pick a client.' }, { status: 400 });

  const store = cookies();
  const supabase = createServerClient(url, anon, {
    cookies: { get: (n: string) => store.get(n)?.value, set: () => {}, remove: () => {} },
  });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const { data: customer } = await supabase
    .from('customers')
    .select('id, org_id, name, contact_name, email, brief')
    .eq('id', body.customerId)
    .maybeSingle();
  if (!customer) return NextResponse.json({ error: 'Client not found.' }, { status: 404 });

  // ---- sending an already-reviewed draft -----------------------------------
  if (body.send) {
    if (!customer.email) return NextResponse.json({ error: 'No email on file for them.' }, { status: 400 });
    const resendKey = process.env.RESEND_API_KEY;
    const { data: org } = await supabase.from('orgs').select('name').eq('id', customer.org_id).maybeSingle();

    if (resendKey) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: process.env.MAIL_FROM || 'CALO&CO <onboarding@resend.dev>',
          to: customer.email,
          subject: body.subject ?? `Update on ${customer.name}`,
          html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.7;color:#111;max-width:520px;">${
            (body.text ?? '').split('\n\n').map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('')
          }<p style="color:#666;font-size:13px;">${org?.name ?? ''}</p></div>`,
        }),
      });
      if (!res.ok) return NextResponse.json({ error: 'Could not send that.' }, { status: 502 });
    }

    /**
     * Logged as outbound, which clears the waiting flag by itself.
     *
     * Sending an update IS contact. Asking somebody to also record that they
     * contacted the client is asking them to keep a second copy of something
     * they just did.
     */
    await supabase.from('customer_notes').insert({
      org_id: customer.org_id,
      customer_id: customer.id,
      kind: 'email',
      direction: 'out',
      body: `Sent an update: ${body.subject}\n\n${body.text}`,
      happened_on: new Date().toISOString().slice(0, 10),
    });

    return NextResponse.json({ sent: true, emailed: Boolean(resendKey) });
  }

  // ---- drafting ------------------------------------------------------------
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Drafting is not configured yet.' }, { status: 500 });

  const since = new Date(Date.now() - 21 * 86400_000).toISOString().slice(0, 10);
  const [{ data: notes }, { data: tasks }, { data: invoices }] = await Promise.all([
    supabase.from('customer_notes').select('kind, direction, body, happened_on')
      .eq('customer_id', customer.id).gte('happened_on', since).order('happened_on', { ascending: false }).limit(10),
    supabase.from('job_tasks').select('name, status, ends_on, owner, job:jobs!inner(customer_id)')
      .eq('job.customer_id', customer.id).limit(25),
    supabase.from('job_invoices').select('number, total, amount_paid, issued_on, job:jobs!inner(customer_id)')
      .eq('job.customer_id', customer.id).limit(5),
  ]);

  const material = [
    `Where things stand, from our own brief:\n${JSON.stringify(customer.brief ?? {}, null, 2)}`,
    tasks?.length ? `The plan:\n${tasks.map((t) => `${t.name}: ${t.status}${t.ends_on ? `, due ${t.ends_on}` : ''}${t.owner === 'client' ? ' (on them)' : t.owner === 'us' ? ' (on us)' : ' (nobody assigned)'}`).join('\n')}` : '',
    notes?.length ? `Recent contact:\n${notes.map((n) => `${n.happened_on} ${n.direction === 'out' ? 'we said' : 'they said'}: ${n.body.slice(0, 300)}`).join('\n')}` : '',
    invoices?.length ? `Billing:\n${invoices.map((i) => `${i.number}: ${i.total} issued ${i.issued_on}, ${i.amount_paid} paid`).join('\n')}` : '',
  ].filter(Boolean).join('\n\n');

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: SYSTEM,
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{
        role: 'user',
        content: `Writing to ${customer.contact_name ?? customer.name} at ${customer.name}.\n\n${material}`,
      }],
    });

    const block = msg.content.find((b) => b.type === 'text');
    if (!block || block.type !== 'text') return NextResponse.json({ error: 'Nothing came back.' }, { status: 502 });

    let draft: Record<string, unknown>;
    try { draft = JSON.parse(block.text); }
    catch { return NextResponse.json({ error: 'Could not read the result.' }, { status: 502 }); }

    const costCents =
      (msg.usage.input_tokens / 1_000_000) * INPUT_PER_MTOK * 100 +
      (msg.usage.output_tokens / 1_000_000) * OUTPUT_PER_MTOK * 100;

    return NextResponse.json({
      ...draft,
      to: customer.email,
      costCents: Math.round(costCents * 100) / 100,
    });
  } catch (e) {
    console.error('[updates]', (e as Error).message);
    return NextResponse.json({ error: `Could not draft that: ${(e as Error).message}` }, { status: 502 });
  }
}
