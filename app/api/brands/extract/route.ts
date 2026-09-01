/**
 * Reading raw intel into the framework.
 *
 * You paste a discovery call, or the founder's email, or the copy off their
 * old site, and this proposes content for the ten modules. It is the step that
 * turns a two hour transcript into something with a shape, which is the part
 * of this work that has always been slow and never been interesting.
 *
 * WHAT IT IS AND IS NOT ALLOWED TO DO
 *
 * It proposes. It never saves, never locks, and never decides. Everything it
 * returns lands in front of a person marked as a proposal, and a proposal that
 * nobody accepts is discarded rather than quietly kept. The framework's own
 * argument is the reason: what reads well is what ships by accident, and a
 * fluent paragraph about a company's positioning is the most plausible-sounding
 * wrong thing this could produce.
 *
 * It is also required to leave modules empty. A discovery call genuinely does
 * not contain a north star, and a reader that fills all ten every time is a
 * reader that is inventing. Empty is the correct answer more often than not,
 * and `missing` says what to go and ask.
 *
 * WHY THE COST IS BOUNDED
 * One call per drop, paid once, at the moment you click. A 6,000 word
 * transcript is roughly 8,000 input tokens and 2,000 out, which is a couple of
 * cents on Haiku. The answer is stored, so rereading it next year is free.
 * There is deliberately no "ask a question about this brand" feature: that is
 * the same work charged again every time somebody is curious.
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { FRAMEWORK } from '@/lib/spine/framework';

export const runtime = 'nodejs';
export const maxDuration = 120;

const MODEL = 'claude-haiku-4-5';
const INPUT_PER_MTOK = 1.0;
const OUTPUT_PER_MTOK = 5.0;

const MAX_CHARS = 90_000;

const SCHEMA = {
  type: 'object' as const,
  properties: {
    modules: {
      type: 'array' as const,
      description:
        'Proposed content, only for modules the material actually supports. Leave a module out entirely rather than writing something thin for it.',
      items: {
        type: 'object' as const,
        properties: {
          id: {
            type: 'string' as const,
            enum: FRAMEWORK.map((m) => m.id),
          },
          content: {
            type: 'string' as const,
            description:
              'The proposed content, written to that module\'s own rules. Prose, not bullet points, unless the module asks for a list.',
          },
          confidence: {
            type: 'string' as const,
            enum: ['stated', 'implied', 'inferred'],
            description:
              'stated: they said this in as many words. implied: it follows closely from what they said. inferred: you are reading between the lines and a person needs to check it.',
          },
          basis: {
            type: 'string' as const,
            description:
              'The line or moment in the material this rests on. Quote it briefly so a person can find it.',
          },
        },
        required: ['id', 'content', 'confidence', 'basis'],
      },
    },
    proof: {
      type: 'array' as const,
      description:
        'Quotes, numbers and customer names present in the material. Everything here is unverified by definition.',
      items: {
        type: 'object' as const,
        properties: {
          kind: { type: 'string' as const, enum: ['quote', 'stat', 'logo'] },
          body: { type: 'string' as const },
          attribution: {
            type: ['string', 'null'] as const,
            description: 'Who said it, exactly as stated. Null if not stated. Never guess.',
          },
          source: {
            type: ['string', 'null'] as const,
            description: 'Where a number came from, if stated. Null otherwise.',
          },
        },
        required: ['kind', 'body'],
      },
    },
    banned: {
      type: 'array' as const,
      description:
        'Words or phrases they said they dislike, or that they use for something internal that must not reach customers. Only where the material gives a reason.',
      items: {
        type: 'object' as const,
        properties: {
          term: { type: 'string' as const },
          reason: { type: 'string' as const },
        },
        required: ['term', 'reason'],
      },
    },
    voice: {
      type: 'array' as const,
      description:
        'Distinctive words and constructions they actually use, drawn from their own speech. Raw material for tone, not a description of it.',
      items: { type: 'string' as const },
    },
    missing: {
      type: 'array' as const,
      description:
        'The most useful things the material does not answer. Written as questions you would ask on the next call.',
      items: { type: 'string' as const },
    },
  },
  required: ['modules', 'proof', 'banned', 'voice', 'missing'],
};

/**
 * The framework itself is the instruction set.
 *
 * Built from the same file the screen renders, so improving a module's rules
 * improves the reading of every future transcript in the same edit. A prompt
 * that restates the framework in its own words is a second copy, and second
 * copies drift.
 */
function frameworkBrief(): string {
  return FRAMEWORK.map((m, i) => {
    const how = m.how.map((h) => `    - ${h}`).join('\n');
    const bad = m.failures.map((f) => `    - ${f}`).join('\n');
    const ask = m.asks.map((a) => `    - ${a}`).join('\n');
    return `${i + 1}. ${m.id}: ${m.name}
  What it is: ${m.job}
  How it must be written:
${how}
  Ways it goes wrong:
${bad}
  What we would ask a client to get it:
${ask}`;
  }).join('\n\n');
}

const SYSTEM = `You read raw material about a company (discovery calls, founder emails, website copy, notes) and propose content for a ten module brand and messaging framework.

THE FRAMEWORK

${frameworkBrief()}

HOW TO WORK

Leaving a module out is a real answer and usually the right one. A single discovery call will support three or four modules well. Proposing all ten from one call means you invented six. Only propose a module when the material genuinely carries it.

Write in their words, not in marketing register. If the founder said "restaurants are drowning in spreadsheets", that sentence is worth more than anything you would write to replace it. Pull their phrasing through wherever it works.

Mark confidence honestly. "stated" means they said it. "inferred" means you are reading between the lines, and a person is going to check that one first, which is exactly what should happen.

Never invent a quote, a name, a number, or a customer. An attribution that was not stated is null. A number without a stated source is still recorded, but its source is null and it stays unverified.

Follow each module's own rules on length and shape. A positioning statement is one sentence. A brand idea is under ten words if it can be. Do not pad to look thorough.

No em-dashes. Use commas or full stops. American spelling throughout.

The missing list is the most valuable thing you produce after the modules themselves. It is the agenda for the next call.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Reading is not configured yet.' }, { status: 500 });
  }

  let body: {
    text?: string;
    brand?: string;
    existing?: Array<{ id: string; content: string }>;
    /** Photographed notes, whiteboards, screenshots. Base64, no data: prefix. */
    images?: Array<{ media_type: string; data: string }>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const text = (body.text ?? '').trim();
  const images = (body.images ?? []).slice(0, 8);

  // A photograph carries the length requirement on its own, so text-only is
  // the only case that has to meet it.
  if (!images.length && text.length < 200) {
    return NextResponse.json(
      { error: 'That is too short to build a framework from. Paste the whole call or note.' },
      { status: 400 }
    );
  }
  if (!images.length && !text) {
    return NextResponse.json({ error: 'Nothing to read.' }, { status: 400 });
  }
  if (text.length > MAX_CHARS) {
    return NextResponse.json(
      {
        error: `That is about ${Math.round(text.length / 1000)}k characters, past the limit. Split it and drop the parts separately.`,
      },
      { status: 400 }
    );
  }

  /**
   * Settled modules go in as context, not as things to rewrite.
   *
   * Without this, a second transcript proposes a fresh positioning statement
   * that competes with the locked one, and somebody has to adjudicate. With
   * it, the reader knows what has been decided and works around it.
   */
  const settled = (body.existing ?? []).filter((m) => m.content?.trim());
  const context = settled.length
    ? `Already decided for this brand. Do not propose replacements for these, and make anything you do propose consistent with them:\n\n${settled
        .map((m) => `${m.id}: ${m.content}`)
        .join('\n\n')}\n\n---\n\n`
    : '';

  const client = new Anthropic({ apiKey });

  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM,
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      messages: [
        {
          role: 'user',
          content: [
            /**
             * Images before text, which is what the vision guidance asks for
             * and matters here: the photograph is usually the whole drop, and
             * the text is a one line note about where it came from.
             */
            ...images.map((img) => ({
              type: 'image' as const,
              source: {
                type: 'base64' as const,
                media_type: img.media_type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                data: img.data,
              },
            })),
            {
              type: 'text' as const,
              text: `${body.brand ? `This is material about ${body.brand}.\n\n` : ''}${context}${
                images.length
                  ? `${images.length} photographed ${images.length === 1 ? 'page' : 'pages'} above. Read the handwriting as carefully as you can. Where a word is genuinely illegible, say so in the basis rather than guessing at it.\n\n`
                  : ''
              }${text}`,
            },
          ],
        },
      ],
    });

    const block = msg.content.find((b) => b.type === 'text');
    if (!block || block.type !== 'text') {
      return NextResponse.json({ error: 'Nothing came back. Try again.' }, { status: 502 });
    }

    let extracted: Record<string, unknown>;
    try {
      extracted = JSON.parse(block.text);
    } catch {
      return NextResponse.json({ error: 'Could not read the result. Try again.' }, { status: 502 });
    }

    const inTok = msg.usage.input_tokens;
    const outTok = msg.usage.output_tokens;
    const costCents =
      (inTok / 1_000_000) * INPUT_PER_MTOK * 100 + (outTok / 1_000_000) * OUTPUT_PER_MTOK * 100;

    return NextResponse.json({
      ...extracted,
      model: MODEL,
      costCents: Math.round(costCents * 100) / 100,
    });
  } catch (e) {
    const message = (e as Error).message;
    console.error('[brands/extract]', message);
    return NextResponse.json({ error: `Could not read that: ${message}` }, { status: 502 });
  }
}
