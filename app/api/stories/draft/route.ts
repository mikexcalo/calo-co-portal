/**
 * Drafting a case study from the work you already did.
 *
 * You asked for this weeks ago, for askcolette.ai, and what got built was a
 * place to put one. That is the audit's finding in miniature: storage where a
 * producer was needed. Writing a case study from scratch is an afternoon
 * nobody has, which is why agencies with good work have thin portfolios.
 *
 * Everything it needs is already recorded. The brand framework holds the
 * positioning and the pillars. Discovery holds what the client said in their
 * own words. The engagement holds what was actually delivered. This assembles
 * those into the five movements and stops.
 *
 * WHAT IT WILL NOT DO
 *
 * Invent a result. Every claim comes back unsourced by default and the
 * database refuses to publish an unsourced claim, so the worst case is a
 * generous draft that cannot reach a customer until somebody stands behind the
 * numbers.
 *
 * And it will not write a paragraph it has no material for. An engagement with
 * no recorded outcome returns an empty outcome, because that is the truth and
 * a fabricated one is the single most expensive sentence an agency can publish.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const maxDuration = 90;

const MODEL = 'claude-haiku-4-5';
const INPUT_PER_MTOK = 1.0;
const OUTPUT_PER_MTOK = 5.0;

const SCHEMA = {
  type: 'object' as const,
  additionalProperties: false,
  properties: {
    title: {
      type: 'string' as const,
      description:
        'The campaign or engagement name, as it would appear on a case study. Short. If the work had a name, use theirs.',
    },
    summary: {
      type: 'string' as const,
      description: 'One sentence. What you did and what changed, without adjectives doing the work.',
    },
    sector: { type: ['string', 'null'] as const },
    roles: {
      type: 'array' as const,
      description: 'What you actually did. Positioning, messaging, identity, website, and so on.',
      items: { type: 'string' as const },
    },
    situation: {
      type: 'string' as const,
      description: 'What was wrong, in the client\'s words rather than yours wherever they gave you words.',
    },
    approach: {
      type: 'string' as const,
      description: 'The decision you made. Usually one structural move, not a list of activities.',
    },
    execution: {
      type: 'string' as const,
      description: 'How it reached the world.',
    },
    enablement: {
      type: 'string' as const,
      description: 'What the team was left with so it held after you stopped. Empty string if there was nothing.',
    },
    outcome: {
      type: 'string' as const,
      description:
        'What happened. Prose only, no numbers: numbers belong in claims where they carry a source. Empty string if nothing is recorded, which is the correct answer more often than not.',
    },
    claims: {
      type: 'array' as const,
      description:
        'Every number or result the material actually contains. Empty if there are none. Never invent one, and never round one up.',
      items: {
        type: 'object' as const,
        additionalProperties: false,
        properties: {
          claim: { type: 'string' as const },
          where_from: {
            type: 'string' as const,
            description: 'Which part of the material this came from, so a person can check it.',
          },
        },
        required: ['claim', 'where_from'],
      },
    },
    missing: {
      type: 'array' as const,
      description: 'What you would need before this could be published. The gaps, named.',
      items: { type: 'string' as const },
    },
  },
  required: ['title', 'summary', 'roles', 'situation', 'approach', 'execution', 'enablement', 'outcome', 'claims', 'missing'],
};

const SYSTEM = `You write case studies from an agency's own records of a piece of work.

The shape is fixed and every case study uses it: the situation, the approach, what shipped, what the team was left with, and what happened.

Rules that matter more than completeness:

Write only from the material. If there is nothing recorded about what happened, the outcome is an empty string and the gap goes in missing. A fabricated result is the single most expensive sentence an agency can publish, and it is the one a prospect repeats back in a meeting.

Numbers never go in the prose. They go in claims, one per number, each saying where it came from. That is not a formatting rule: a number inside a paragraph cannot be checked, and one in its own row can.

Use the client's words wherever they gave you words. A phrase somebody used about their own business beats anything you would write to replace it.

The approach is one structural move, not a list of things you did. "Reorganized the product around three pillars" is an approach. "Provided branding, messaging and web design" is a list.

No em-dashes. American spelling. No marketing register: this is read by somebody deciding whether to hire, and the writing that wins there sounds like a person who did the work.`;

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return NextResponse.json({ error: 'Not configured.' }, { status: 500 });

  let body: { customerId?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }
  if (!body.customerId) return NextResponse.json({ error: 'Pick a client.' }, { status: 400 });

  const store = cookies();
  const supabase = createServerClient(url, anon, {
    cookies: { get: (n: string) => store.get(n)?.value, set: () => {}, remove: () => {} },
  });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const [{ data: customer }, { data: brands }, { data: answers }, { data: jobs }] = await Promise.all([
    supabase.from('customers').select('name, website, brief').eq('id', body.customerId).maybeSingle(),
    supabase.from('brands').select('id, name, messaging, kit').eq('customer_id', body.customerId),
    supabase.from('discovery').select('subject, question, answer').eq('customer_id', body.customerId).limit(20),
    supabase.from('jobs').select('name, description, status, completed_on').eq('customer_id', body.customerId),
  ]);

  if (!customer) return NextResponse.json({ error: 'Client not found.' }, { status: 404 });

  const brand = brands?.[0];
  const modules = ((brand?.messaging ?? []) as Array<{ name: string; content: string; state: string }>)
    .filter((m) => m.content?.trim());

  const proof = brand
    ? (await supabase.from('brand_proof').select('kind, body, attribution, status').eq('brand_id', brand.id)).data ?? []
    : [];

  /**
   * Refuse early rather than produce something thin.
   *
   * A case study assembled from a client name and nothing else is worse than
   * no case study: it looks like output, so nobody goes back for the material
   * that was actually missing.
   */
  const material = [
    customer.brief ? `The brief we keep on them:\n${JSON.stringify(customer.brief, null, 2)}` : '',
    modules.length ? `Their brand framework:\n${modules.map((m) => `${m.name} (${m.state}): ${m.content}`).join('\n\n')}` : '',
    answers?.length ? `What they told us:\n${answers.map((a) => `[${a.subject}] ${a.question}\n${a.answer ?? ''}`).join('\n\n')}` : '',
    jobs?.length ? `The work:\n${jobs.map((j) => `${j.name}${j.description ? `: ${j.description}` : ''} (${j.status}${j.completed_on ? `, finished ${j.completed_on}` : ''})`).join('\n')}` : '',
    proof.length ? `Proof on file:\n${proof.map((p) => `[${p.status}] ${p.body}${p.attribution ? ` — ${p.attribution}` : ''}`).join('\n')}` : '',
  ].filter(Boolean).join('\n\n---\n\n');

  if (material.length < 300) {
    return NextResponse.json(
      { error: 'Not enough on file to write from. A brand framework, some discovery, or a finished engagement would give it something to work with.' },
      { status: 400 }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Drafting is not configured yet.' }, { status: 500 });

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 3000,
      system: SYSTEM,
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{
        role: 'user',
        content: `Client: ${customer.name}${customer.website ? ` (${customer.website})` : ''}\n\n${material}`,
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
      client: customer.name,
      costCents: Math.round(costCents * 100) / 100,
    });
  } catch (e) {
    console.error('[stories/draft]', (e as Error).message);
    return NextResponse.json({ error: `Could not draft that: ${(e as Error).message}` }, { status: 502 });
  }
}
