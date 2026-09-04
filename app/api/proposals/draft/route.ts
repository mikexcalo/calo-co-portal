/**
 * Turning what a client told you into something you can send them.
 *
 * The audit's finding was that this product stores and never produces. This is
 * the first thing that produces. You pick the answers that describe work, and
 * it comes back as a scoped proposal: line items with prices, what is included,
 * and the more valuable list of what is not.
 *
 * WHY THIS IS THE RIGHT PLACE FOR A MODEL
 *
 * The gap between "admin, digital presence and technical buildout are not worth
 * my time" and a priced scope is judgement about phrasing, not arithmetic. It
 * is the same shape as reading a transcript: no columns to match, and the
 * useful output is prose somebody edits.
 *
 * WHAT IT IS NOT ALLOWED TO DO
 *
 * It proposes lines and never saves them. It never sets a price it was not
 * given a basis for: with no rate on file it returns quantities and leaves the
 * money blank, because a plausible invented number in a proposal is the worst
 * possible place for one.
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
    name: {
      type: 'string' as const,
      description:
        'What to call this piece of work, in the words the client would use. Six words at most.',
    },
    summary: {
      type: 'string' as const,
      description: 'One or two sentences a client reads before the price. Their situation, not your services.',
    },
    lines: {
      type: 'array' as const,
      description:
        'The work, one line per deliverable. Only what the material actually supports. Four to eight is usually right; twelve means you are padding.',
      items: {
        type: 'object' as const,
        additionalProperties: false,
        properties: {
          description: { type: 'string' as const, description: 'The deliverable, as the client would describe it.' },
          qty: { type: 'number' as const, description: 'Hours if the basis is hourly, otherwise 1.' },
          unit: { type: ['string', 'null'] as const },
          optional: {
            type: 'boolean' as const,
            description:
              'True for anything they did not ask for but would plausibly want. These are offered as add-ons rather than assumed.',
          },
          basis: {
            type: 'string' as const,
            description: 'The thing they said that this line answers. Quoted briefly.',
          },
        },
        required: ['description', 'qty', 'unit', 'optional', 'basis'],
      },
    },
    scope_in: {
      type: 'array' as const,
      description: 'What the price covers, in plain terms. Short lines.',
      items: { type: 'string' as const },
    },
    scope_out: {
      type: 'array' as const,
      description:
        'What it does not cover. The more valuable list, and the one nobody writes unprompted. Name the things a reader would otherwise assume in their own favor.',
      items: { type: 'string' as const },
    },
    ask_first: {
      type: 'array' as const,
      description: 'What you would need to know before sending this. Empty if nothing.',
      items: { type: 'string' as const },
    },
  },
  required: ['name', 'summary', 'lines', 'scope_in', 'scope_out', 'ask_first'],
};

const SYSTEM = `You turn things a client said into a scoped proposal.

The input is answers they gave to discovery questions. Your job is to find the work inside them and price the shape of it, not to invent an engagement.

Rules that matter more than completeness:

Only propose work the material supports. If somebody says admin and technical buildout are not worth their time, that is four or five concrete deliverables and you should name them. If they said nothing about a website, do not propose one.

Every line cites what it answers. If you cannot point at the sentence it came from, do not include the line.

The exclusions list is the valuable half. Name what a reader would otherwise assume is included: rounds of revision, ongoing work after launch, content they have to supply, anything conditional on a third party. This is what stops a fixed fee losing money in week six.

Mark anything they did not ask for as optional. It is offered, not assumed, and a pre-assumed extra reads as padding.

Write in their words where they gave you words. A phrase a client used about their own business is worth more than anything you would write to replace it.

No em-dashes. American spelling. Do not write pricing rationale, marketing language, or a covering letter.`;

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return NextResponse.json({ error: 'Not configured.' }, { status: 500 });

  let body: { customerId?: string; ids?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }

  const store = cookies();
  const supabase = createServerClient(url, anon, {
    cookies: { get: (n: string) => store.get(n)?.value, set: () => {}, remove: () => {} },
  });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const ids = Array.isArray(body.ids) ? (body.ids as unknown[]).filter((x): x is string => typeof x === 'string') : [];
  if (!body.customerId || ids.length === 0) {
    return NextResponse.json({ error: 'Pick at least one thing they told you.' }, { status: 400 });
  }

  const [{ data: answers }, { data: customer }, { data: org }] = await Promise.all([
    supabase.from('discovery').select('subject, question, answer, note').in('id', ids),
    supabase.from('customers').select('name, contact_name').eq('id', body.customerId).maybeSingle(),
    supabase.from('orgs').select('name, default_labor_rate, billing_style').limit(1).maybeSingle(),
  ]);

  if (!answers?.length) return NextResponse.json({ error: 'Could not read those.' }, { status: 404 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Drafting is not configured yet.' }, { status: 500 });

  /**
   * The rate is stated when there is one and its absence is stated when there
   * is not. A model told nothing about money will invent a number, and a
   * proposal is the single worst place for a plausible invented number.
   */
  const rate = Number(org?.default_labor_rate ?? 0);
  const basis = rate > 0
    ? `The default rate is ${rate} an hour. Use hours as the quantity where the work is time-based.`
    : `No rate is on file. Use a quantity of 1 for every line and do not attempt to price anything.`;

  const material = answers
    .map((a) => `[${a.subject ?? 'General'}] ${a.question}\n${a.answer ?? '(no answer)'}${a.note ? `\nYour note: ${a.note}` : ''}`)
    .join('\n\n');

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 2500,
      system: SYSTEM,
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{
        role: 'user',
        content: `Client: ${customer?.name ?? 'them'}${customer?.contact_name ? `, contact ${customer.contact_name}` : ''}.\n${basis}\n\nWhat they told you:\n\n${material}`,
      }],
    });

    const block = msg.content.find((b) => b.type === 'text');
    if (!block || block.type !== 'text') {
      return NextResponse.json({ error: 'Nothing came back. Try again.' }, { status: 502 });
    }

    let draft: Record<string, unknown>;
    try { draft = JSON.parse(block.text); }
    catch { return NextResponse.json({ error: 'Could not read the result.' }, { status: 502 }); }

    const costCents =
      (msg.usage.input_tokens / 1_000_000) * INPUT_PER_MTOK * 100 +
      (msg.usage.output_tokens / 1_000_000) * OUTPUT_PER_MTOK * 100;

    return NextResponse.json({
      ...draft,
      rate: rate > 0 ? rate : null,
      costCents: Math.round(costCents * 100) / 100,
    });
  } catch (e) {
    console.error('[proposals/draft]', (e as Error).message);
    return NextResponse.json({ error: `Could not draft that: ${(e as Error).message}` }, { status: 502 });
  }
}
