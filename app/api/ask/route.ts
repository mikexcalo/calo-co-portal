/**
 * Asking the product about your own data.
 *
 * "Who owes me money" should not require knowing which screen holds the
 * answer. It should be a sentence.
 *
 * HOW IT WORKS, AND WHAT IT REFUSES TO DO
 *
 * The model reads the question and returns one id from a fixed list. It never
 * writes a query, never sees a row, and never does arithmetic. Postgres runs
 * the query as the signed-in person, so row level security applies exactly as
 * it does on every screen, and the numbers are computed by the database.
 *
 * That split is the whole design. A model summarising forty invoices will
 * usually add them up correctly, and usually is not a standard for money. This
 * way the worst failure is picking the wrong question, which a reader spots
 * instantly, rather than a subtly wrong total, which nobody does.
 *
 * WHAT IT COSTS
 *
 * A classification call is roughly 600 tokens in and 30 out, about a tenth of
 * a cent on Haiku. An exact match against the listed questions skips the model
 * entirely, so the common ones cost nothing at all.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Anthropic from '@anthropic-ai/sdk';
import { QUESTIONS, QUESTION_IDS } from '@/lib/spine/questions';

export const runtime = 'nodejs';
export const maxDuration = 30;

const MODEL = 'claude-haiku-4-5';
const INPUT_PER_MTOK = 1.0;
const OUTPUT_PER_MTOK = 5.0;

const SCHEMA = {
  type: 'object' as const,
  properties: {
    id: {
      type: ['string', 'null'] as const,
      enum: [...QUESTION_IDS, null],
      description: 'The question being asked. Null if none of them fit.',
    },
  },
  required: ['id'],
};

const SYSTEM = `You match a question about a small business to one of the questions the software can answer.

${QUESTIONS.map((q) => `${q.id}: ${q.description} (e.g. "${q.example}")`).join('\n')}

Return the single closest id. If the question is about something not on this list, return null rather than forcing a poor match: a confident wrong answer is worse than saying you cannot answer it.`;

/** Cheap normalizing, so an exact ask never pays for a model call. */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return NextResponse.json({ error: 'Not configured.' }, { status: 500 });

  let body: { question?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }

  const question = (body.question ?? '').trim();
  if (question.length < 3) return NextResponse.json({ error: 'Ask something.' }, { status: 400 });

  const store = cookies();
  const supabase = createServerClient(url, anon, {
    cookies: { get: (n: string) => store.get(n)?.value, set: () => {}, remove: () => {} },
  });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  // Free path: somebody clicked a suggestion, or typed one verbatim.
  let id: string | null = QUESTIONS.find((q) => norm(q.example) === norm(question))?.id ?? null;
  let costCents = 0;

  if (!id) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'Answering is not configured yet.' }, { status: 500 });

    /**
     * Everything below has to return JSON, including when it fails.
     *
     * Without this the model call threw, Next returned an empty 500 body, and
     * the browser reported "Unexpected end of JSON input", which tells the
     * person nothing about what went wrong. A route the UI parses as JSON must
     * never have a path that returns something else.
     */
    try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 100,
      system: SYSTEM,
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content: question }],
    });
    const block = msg.content.find((b) => b.type === 'text');
    if (block?.type === 'text') {
      try { id = (JSON.parse(block.text).id as string | null) ?? null; } catch { id = null; }
    }
    costCents =
      (msg.usage.input_tokens / 1_000_000) * INPUT_PER_MTOK * 100 +
      (msg.usage.output_tokens / 1_000_000) * OUTPUT_PER_MTOK * 100;
    } catch (e) {
      console.error('[ask]', (e as Error).message);
      return NextResponse.json(
        { error: `Could not work out what you were asking: ${(e as Error).message}` },
        { status: 502 }
      );
    }
  }

  const q = QUESTIONS.find((x) => x.id === id);
  if (!q) {
    return NextResponse.json({
      answer: null,
      // Naming what it can do beats apologizing for what it cannot.
      suggestions: QUESTIONS.map((x) => x.example),
      costCents: Math.round(costCents * 100) / 100,
    });
  }

  const { data, error } = await supabase.rpc('answer_question', { qid: q.id });
  if (error) return NextResponse.json({ error: error.message }, { status: 502 });

  // The function returns one row holding a jsonb array.
  const raw = Array.isArray(data) ? (data[0]?.result ?? data[0]) : data;
  const rows = (Array.isArray(raw) ? raw : []) as Record<string, unknown>[];

  return NextResponse.json({
    id: q.id,
    question: q.example,
    answer: q.format(rows),
    costCents: Math.round(costCents * 100) / 100,
  });
}
