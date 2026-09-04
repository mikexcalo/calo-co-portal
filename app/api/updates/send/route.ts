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
  additionalProperties: false,
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

  let body: { customerId?: string; send?: boolean; subject?: string; text?: string; to?: string };
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

  /**
   * Who it could go to, as people.
   *
   * An update is written to a person, not to a company. The company record has
   * an email on it because somebody had to type one somewhere, but the name
   * next to it is the one who reads it, and the two were never shown together.
   */
  const { data: contactRows } = await supabase
    .from('customer_contacts')
    .select('name, title, email, is_primary')
    .eq('customer_id', customer.id)
    .not('email', 'is', null)
    .order('is_primary', { ascending: false })
    .order('name');

  const people: Array<{ name: string; title: string | null; email: string }> = [];
  (contactRows ?? []).forEach((c) => {
    if (c.email) people.push({ name: c.name, title: c.title ?? null, email: c.email });
  });
  // The address on the company record, only if no person already claims it.
  if (customer.email && !people.some((p) => p.email.toLowerCase() === customer.email!.toLowerCase())) {
    people.push({
      name: customer.contact_name ?? customer.name,
      title: customer.contact_name ? null : 'on the company record',
      email: customer.email,
    });
  }

  const from = process.env.MAIL_FROM || 'CALO&CO <onboarding@resend.dev>';

  // ---- sending an already-reviewed draft -----------------------------------
  if (body.send) {
    /**
     * The address has to be one already on file against this client.
     *
     * The recipient arrives from the browser so it can be picked, and a field
     * that both arrives from the browser and gets mailed is a way to send mail
     * from your domain to anybody at all. It gets checked against the people
     * on the record instead of trusted.
     */
    const to = (body.to ?? '').trim().toLowerCase();
    const target = people.find((p) => p.email.toLowerCase() === to);
    if (!target) {
      return NextResponse.json(
        { error: people.length ? 'Pick somebody on this client to send to.' : 'Nobody on this client has an email on file.' },
        { status: 400 }
      );
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      return NextResponse.json({ error: 'Email is not connected, so nothing would actually go out.' }, { status: 500 });
    }

    const { data: org } = await supabase.from('orgs').select('name').eq('id', customer.org_id).maybeSingle();

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: target.email,
        subject: body.subject ?? `Update on ${customer.name}`,
        html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.7;color:#111;max-width:520px;">${
          (body.text ?? '').split('\n\n').map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('')
        }<p style="color:#666;font-size:13px;">${org?.name ?? ''}</p></div>`,
      }),
    });

    /**
     * The reason comes back, not just the failure.
     *
     * "Could not send that" covers a wrong key, an unverified domain and a
     * bounced address identically, and the fix for each is different. The one
     * that will actually happen first: the fallback from address is Resend's
     * shared test domain, which only delivers to the account owner.
     */
    if (!res.ok) {
      const detail = await res.json().catch(() => null) as { message?: string } | null;
      return NextResponse.json(
        { error: detail?.message ?? `The mail service refused it (${res.status}).` },
        { status: 502 }
      );
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
      body: `Emailed ${target.name} at ${target.email}: ${body.subject}\n\n${body.text}`,
      happened_on: new Date().toISOString().slice(0, 10),
    });

    return NextResponse.json({ sent: true, to: target.email, name: target.name });
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

  /**
   * Nothing recorded means nothing to write, and it has to say so here.
   *
   * Handed an empty brief and no history the model does the reasonable thing
   * and writes back asking for the project details, which arrives looking
   * exactly like a finished draft with a send button under it. Subject line:
   * "Unable to draft email - no project details provided". One wrong click
   * from going to a client.
   */
  const brief = (customer.brief ?? {}) as Record<string, unknown>;
  const briefWritten = Object.values(brief).some((v) => typeof v === 'string' && v.trim().length > 20);
  if (!briefWritten && !notes?.length && !tasks?.length && !invoices?.length) {
    return NextResponse.json(
      {
        error:
          `There is nothing recorded against ${customer.name} to write from. Fill in the brief, or drop a note about the last conversation, and it will have something to say.`,
      },
      { status: 400 }
    );
  }

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
      people,
      from,
      // The shared test domain only delivers to the Resend account owner, so
      // the screen has to say that before the send rather than after it.
      testDomain: !process.env.MAIL_FROM,
      costCents: Math.round(costCents * 100) / 100,
    });
  } catch (e) {
    console.error('[updates]', (e as Error).message);
    return NextResponse.json({ error: `Could not draft that: ${(e as Error).message}` }, { status: 502 });
  }
}
