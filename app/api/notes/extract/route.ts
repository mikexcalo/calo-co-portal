/**
 * Reading a transcript or a page of notes.
 *
 * This is the second and last place model tokens get spent, and it earns it
 * where the spreadsheet import does not: a call transcript genuinely is a
 * comprehension problem. There are no columns to match. Somebody said "he
 * wants the deck stained before the fourth" and that has to become a date, a
 * task and a customer.
 *
 * WHY IT IS STILL BOUNDED
 * One call per note, paid once, at the moment you paste it. A 3,000-word
 * transcript is roughly 4,000 input tokens and 800 out — about a cent on
 * Haiku. Reading it back next year costs nothing, because the answer was
 * stored rather than re-derived. There is deliberately no "ask a question
 * about my notes" feature: that is the same work charged again every time
 * somebody is curious, and it never terminates.
 *
 * NOTHING IT PRODUCES IS SAVED WITHOUT A PERSON SEEING IT. A model reading a
 * noisy transcript will occasionally hear a number wrong, and a wrong number
 * in a business record is worse than no record. The approval screen is not
 * politeness, it is the thing that makes this safe to use.
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MODEL = 'claude-haiku-4-5';
const INPUT_PER_MTOK = 1.0;
const OUTPUT_PER_MTOK = 5.0;

/** Roughly four characters to a token — enough to refuse the absurd. */
const MAX_CHARS = 60_000;

const SCHEMA = {
  type: 'object' as const,
  additionalProperties: false,
  properties: {
    title: {
      type: 'string' as const,
      description: 'A short heading for this note, six words at most.',
    },
    summary: {
      type: 'string' as const,
      description:
        'What happened, in two or three plain sentences someone could read in six months and understand.',
    },
    people: {
      type: 'array' as const,
      description: 'People named, with any contact details actually stated. Never invent one.',
      items: {
        type: 'object' as const,
        additionalProperties: false,
        properties: {
          name: { type: 'string' as const },
          role: { type: ['string', 'null'] as const, description: 'Their role, if stated.' },
          email: { type: ['string', 'null'] as const },
          phone: { type: ['string', 'null'] as const },
        },
        required: ['name', 'role', 'email', 'phone'],
      },
    },
    tasks: {
      type: 'array' as const,
      description: 'Things somebody committed to doing. Only what was actually agreed.',
      items: {
        type: 'object' as const,
        additionalProperties: false,
        properties: {
          what: { type: 'string' as const },
          who: { type: ['string', 'null'] as const },
          due: {
            type: ['string', 'null'] as const,
            description: 'ISO date, only if a specific date was stated or is unambiguous.',
          },
        },
        required: ['what', 'who', 'due'],
      },
    },
    amounts: {
      type: 'array' as const,
      description: 'Money discussed, with what it referred to. Empty if none was.',
      items: {
        type: 'object' as const,
        additionalProperties: false,
        properties: {
          amount: { type: 'number' as const },
          what: { type: 'string' as const },
        },
        required: ['amount', 'what'],
      },
    },
    happened_on: {
      type: ['string', 'null'] as const,
      description: 'ISO date this conversation took place, only if stated.',
    },
    /**
     * Proposed changes to the client model, never applied automatically.
     *
     * This is the half that was missing: a call could become a note and a
     * task, and the eight fields describing the client stayed exactly as they
     * were, so the brief drifted out of date while notes piled up underneath
     * it.
     *
     * Proposals rather than writes, because a rambling five minutes about
     * shipping costs must never be allowed to overwrite a paragraph somebody
     * wrote carefully about the economics. The person accepts each one.
     */
    brief_updates: {
      type: 'array' as const,
      description:
        'Changes to the standing description of this client. Only include a field if the note genuinely adds to or contradicts it. Silence about a field is not a reason to rewrite it. Most notes change nothing here, and an empty array is the correct answer.',
      items: {
        type: 'object' as const,
        additionalProperties: false,
        properties: {
          field: {
            type: 'string' as const,
            enum: ['opportunity', 'offer', 'buyers', 'edge', 'economics', 'gtm', 'constraints', 'ours'],
          },
          text: {
            type: 'string' as const,
            description:
              'The field rewritten in full, incorporating what the note adds. Not a diff and not an append: the whole field as it should now read.',
          },
          why: {
            type: 'string' as const,
            description: 'What in the note caused this, in one short sentence, so somebody can check you.',
          },
        },
        required: ['field', 'text', 'why'],
      },
    },
    waiting_on: {
      type: ['string', 'null'] as const,
      description:
        'What you are now waiting on them for, in a few words, if the note establishes one. Null if nothing is outstanding.',
    },
    uncertain: {
      type: 'array' as const,
      description:
        'Anything you were unsure about — a half-heard number, an ambiguous name, a date that could read two ways. Say so here rather than guessing in the fields above.',
      items: { type: 'string' as const },
    },
  },
  required: ['title', 'summary', 'people', 'tasks', 'amounts', 'happened_on', 'brief_updates', 'waiting_on', 'uncertain'],
};

const SYSTEM = `You pull the useful facts out of meeting notes, call transcripts and scribbled notes for a small business.

Rules that matter more than completeness:

- Never invent a detail. If an email address was not said, it is null. A plausible-looking invented phone number is worse than an empty field, because somebody will dial it.
- Only record a task if somebody actually committed to it. "We should probably look at that sometime" is not a task.
- Only record a date if it was stated or is unambiguous from context. "Next Tuesday" with no anchor date is not a date — put it in uncertain instead.
- If audio was transcribed badly and you are guessing at a word that changes the meaning — a number, a name, an amount — put it in uncertain and leave the field empty.
- Write the summary for the person who was in the room, six months later. Plain sentences, no headings, no bullet points, no throat-clearing.

On brief_updates specifically:

- The default is an empty array. Most calls do not change what a business is, who it sells to or how it makes money.
- Only propose a field when the note adds something durable or contradicts what is there. A one-off scheduling detail is a note, not a change to the client model.
- When you do propose one, write the field in full as it should now read, keeping everything still true from the current version. You are handed the current text; do not discard a paragraph because the note did not mention it.
- Say plainly in the why field what was said that caused it. Somebody is going to check you against the transcript.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Note reading is not configured yet.' }, { status: 500 });
  }

  let body: {
    text?: string;
    context?: string;
    /**
     * The eight fields as they currently read.
     *
     * Sent so a proposed rewrite keeps what is still true. Without it the
     * model can only write what the call mentioned, which would quietly
     * delete a paragraph about economics because today's call was about
     * shipping.
     */
    brief?: Record<string, string>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const text = (body.text ?? '').trim();
  if (text.length < 40) {
    return NextResponse.json(
      { error: "That's too short to be worth reading — just type it in as a note." },
      { status: 400 }
    );
  }
  if (text.length > MAX_CHARS) {
    return NextResponse.json(
      {
        error: `That's about ${Math.round(text.length / 1000)}k characters, which is past the limit. Split it into sessions and paste them one at a time.`,
      },
      { status: 400 }
    );
  }

  const client = new Anthropic({ apiKey });

  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: SYSTEM,
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      messages: [
        {
          role: 'user',
          content: [
            body.context ? `This relates to: ${body.context}` : '',
            body.brief && Object.keys(body.brief).length
              ? `What is currently on file about this client. Keep anything still true when you rewrite a field:\n${Object.entries(
                  body.brief
                )
                  .filter(([, v]) => v && String(v).trim())
                  .map(([k, v]) => `[${k}]\n${v}`)
                  .join('\n\n')}`
              : '',
            `The note:\n${text}`,
          ]
            .filter(Boolean)
            .join('\n\n'),
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

    // Measured, not estimated — the running total should never be a surprise.
    const inTok = msg.usage.input_tokens;
    const outTok = msg.usage.output_tokens;
    const costCents =
      (inTok / 1_000_000) * INPUT_PER_MTOK * 100 + (outTok / 1_000_000) * OUTPUT_PER_MTOK * 100;

    return NextResponse.json({
      extracted,
      model: MODEL,
      costCents: Math.round(costCents * 100) / 100,
    });
  } catch (e) {
    const msg = (e as Error).message;
    console.error('[notes/extract]', msg);
    return NextResponse.json({ error: `Could not read that: ${msg}` }, { status: 502 });
  }
}
