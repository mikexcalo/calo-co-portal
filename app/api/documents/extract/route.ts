/**
 * Document extraction — the shoebox pipeline.
 *
 * Reads one document and returns structured data. This is the ONLY place the
 * new modules spend model tokens, and it is deliberately a per-document,
 * one-time cost rather than a per-query one:
 *
 *   - A receipt runs ~2,000 input tokens and ~500 output tokens.
 *   - On Haiku 4.5 ($1/MTok in, $5/MTok out) that is about half a cent.
 *   - 1,000 documents ≈ $5, once, ever.
 *
 * There is no chat and no semantic search over this data on purpose — those
 * are unbounded recurring costs. Extraction is bounded and it terminates.
 *
 * The measured cost of every call is returned and stored on the document, so
 * the running total is always visible instead of being a surprise.
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Haiku 4.5 — cheapest model that reads receipts reliably. */
const MODEL = 'claude-haiku-4-5';
const INPUT_PER_MTOK = 1.0;
const OUTPUT_PER_MTOK = 5.0;

const SUPPORTED_IMAGE = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;

const EXTRACTION_SCHEMA = {
  type: 'object' as const,
  properties: {
    kind: {
      type: 'string' as const,
      enum: ['receipt', 'invoice', 'estimate', 'permit', 'contract', 'photo', 'other', 'unknown'],
      description: 'What kind of document this is.',
    },
    vendor: { type: ['string', 'null'] as const, description: 'Merchant or supplier name.' },
    purchased_on: {
      type: ['string', 'null'] as const,
      description: 'Transaction date as YYYY-MM-DD. Null if not legible.',
    },
    amount: {
      type: ['number', 'null'] as const,
      description: 'Grand total including tax, as a number. Null if not legible.',
    },
    tax: { type: ['number', 'null'] as const, description: 'Tax portion, if shown separately.' },
    category: {
      type: ['string', 'null'] as const,
      enum: ['material', 'subcontractor', 'equipment', 'permit', 'other', null],
      description: 'Best guess at the job-cost category.',
    },
    line_items: {
      type: ['array', 'null'] as const,
      items: {
        type: 'object' as const,
        properties: {
          description: { type: 'string' as const },
          amount: { type: 'number' as const },
        },
        required: ['description', 'amount'],
        additionalProperties: false,
      },
      description: 'Individual line items when legible.',
    },
    summary: {
      type: 'string' as const,
      description: 'One short line a contractor would recognize, e.g. "Lumber — framing, Home Depot".',
    },
    needs_review: {
      type: 'boolean' as const,
      description: 'True when anything material was illegible, ambiguous, or guessed.',
    },
    review_reason: {
      type: ['string', 'null'] as const,
      description: 'Why review is needed. Null when needs_review is false.',
    },
  },
  required: ['kind', 'vendor', 'purchased_on', 'amount', 'summary', 'needs_review'],
  additionalProperties: false,
};

const SYSTEM = `You read construction business paperwork — receipts, supplier invoices, permits, contracts — and turn them into structured job-cost data.

Rules:
- Report only what the document actually shows. Never invent a vendor, date, or amount.
- If a value is smudged, cut off, or ambiguous, set it to null and set needs_review to true.
- amount is the grand total INCLUDING tax.
- Dates are YYYY-MM-DD. A receipt showing "3/14/26" is 2026-03-14.
- A guessed value is worse than a null one: a null prompts a human to look, a wrong number becomes a wrong invoice.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 500 });
  }

  let body: { fileBase64?: string; mediaType?: string; fileName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { fileBase64, mediaType, fileName } = body;
  if (!fileBase64 || !mediaType) {
    return NextResponse.json(
      { error: 'fileBase64 and mediaType are required' },
      { status: 400 }
    );
  }

  const isPdf = mediaType === 'application/pdf';
  const isImage = (SUPPORTED_IMAGE as readonly string[]).includes(mediaType);
  if (!isPdf && !isImage) {
    return NextResponse.json(
      { error: `Unsupported type ${mediaType}. Use PDF or JPEG/PNG/GIF/WebP.` },
      { status: 400 }
    );
  }

  const client = new Anthropic({ apiKey });

  try {
    const prompt = `Extract the job-cost data from this document${
      fileName ? ` (filename: ${fileName})` : ''
    }.`;

    const content: Anthropic.ContentBlockParam[] = isPdf
      ? [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileBase64 } },
          { type: 'text', text: prompt },
        ]
      : [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: fileBase64,
            },
          },
          { type: 'text', text: prompt },
        ];

    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: SYSTEM,
      output_config: {
        format: { type: 'json_schema', schema: EXTRACTION_SCHEMA },
      },
      messages: [{ role: 'user', content }],
    });

    const text = msg.content.find((b) => b.type === 'text');
    if (!text || text.type !== 'text') {
      return NextResponse.json({ error: 'No content returned' }, { status: 502 });
    }

    let extracted: Record<string, unknown>;
    try {
      extracted = JSON.parse(text.text);
    } catch {
      return NextResponse.json(
        { error: 'Model returned unparseable JSON', raw: text.text.slice(0, 500) },
        { status: 502 }
      );
    }

    // Real measured cost, not an estimate.
    const inTok = msg.usage.input_tokens;
    const outTok = msg.usage.output_tokens;
    const costCents =
      ((inTok / 1_000_000) * INPUT_PER_MTOK + (outTok / 1_000_000) * OUTPUT_PER_MTOK) * 100;

    return NextResponse.json({
      extracted,
      meta: {
        model: MODEL,
        input_tokens: inTok,
        output_tokens: outTok,
        cost_cents: Number(costCents.toFixed(4)),
      },
    });
  } catch (err) {
    const e = err as { status?: number; message?: string };

    // Surface the cases worth acting on differently from generic failures.
    if (e.status === 429) {
      return NextResponse.json(
        { error: 'Rate limited — retry shortly.' },
        { status: 429 }
      );
    }
    if (e.status === 401) {
      return NextResponse.json({ error: 'Invalid ANTHROPIC_API_KEY.' }, { status: 500 });
    }

    console.error('[documents/extract]', e.message);
    return NextResponse.json(
      { error: e.message || 'Extraction failed' },
      { status: 502 }
    );
  }
}
