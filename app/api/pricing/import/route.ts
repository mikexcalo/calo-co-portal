/**
 * Read an existing price list into structured rows.
 *
 * Same shape and same economics as receipt reading: one bounded cost per
 * document, roughly half a cent, never charged again. A price list is read
 * once and then lives in the database.
 *
 * Nothing is saved here — the rows come back for a human to check first. A
 * misread price becomes a wrong estimate to a customer, which is expensive in
 * a way a misread receipt isn't.
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MODEL = 'claude-haiku-4-5';
const INPUT_PER_MTOK = 1.0;
const OUTPUT_PER_MTOK = 5.0;

const SUPPORTED_IMAGE = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;

const SCHEMA = {
  type: 'object' as const,
  properties: {
    items: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          name: { type: 'string' as const, description: 'What the line is called.' },
          description: { type: ['string', 'null'] as const },
          category: {
            type: ['string', 'null'] as const,
            description: 'Section heading it sat under, if any.',
          },
          unit: {
            type: ['string', 'null'] as const,
            description: 'What it is priced by — hr, sq ft, each, room, day.',
          },
          unit_price: {
            type: ['number', 'null'] as const,
            description: 'Price as a number. Null if not legible.',
          },
          kind: {
            type: 'string' as const,
            enum: ['labor', 'material', 'subcontractor', 'other'],
          },
        },
        required: ['name', 'description', 'unit', 'unit_price', 'kind', 'category'],
        additionalProperties: false,
      },
    },
    notes: {
      type: ['string', 'null'] as const,
      description: 'Anything ambiguous a human should check.',
    },
  },
  required: ['items', 'notes'],
  additionalProperties: false,
};

const SYSTEM = `You read contractor price lists — PDFs, photographed sheets, rate cards — and turn them into structured line items.

Rules:
- Extract only lines that have a real price. Skip headers, notes, and terms.
- unit_price is a plain number: "$1,250.00/room" is 1250.
- Put the section heading a line sat under into category.
- Infer kind from the work: crew time is labor, supplied goods are material, anything named as another trade is subcontractor.
- If a price is a range ("$800–1,200"), use the LOW number and say so in notes. Never split the difference — a quoted price that turns out low is a conversation, one that turns out high loses the job.
- If a price is illegible, set unit_price to null rather than guessing.`;

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
    return NextResponse.json({ error: 'fileBase64 and mediaType are required' }, { status: 400 });
  }

  const isPdf = mediaType === 'application/pdf';
  const isImage = (SUPPORTED_IMAGE as readonly string[]).includes(mediaType);
  if (!isPdf && !isImage) {
    return NextResponse.json(
      { error: `Unsupported type ${mediaType}. Use a PDF or an image.` },
      { status: 400 }
    );
  }

  const client = new Anthropic({ apiKey });

  try {
    const prompt = `Extract every priced line item from this price list${
      fileName ? ` (${fileName})` : ''
    }.`;

    const content: Anthropic.ContentBlockParam[] = isPdf
      ? [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: fileBase64 },
          },
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
      // A long price list needs room; truncating mid-list silently loses items.
      max_tokens: 8000,
      system: SYSTEM,
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content }],
    });

    const text = msg.content.find((b) => b.type === 'text');
    if (!text || text.type !== 'text') {
      return NextResponse.json({ error: 'No content returned' }, { status: 502 });
    }

    if (msg.stop_reason === 'max_tokens') {
      return NextResponse.json(
        {
          error:
            'That price list was too long to read in one pass. Split it into sections and import them separately.',
        },
        { status: 413 }
      );
    }

    let parsed: { items?: unknown[]; notes?: string };
    try {
      parsed = JSON.parse(text.text);
    } catch {
      return NextResponse.json({ error: 'Model returned unparseable JSON' }, { status: 502 });
    }

    const inTok = msg.usage.input_tokens;
    const outTok = msg.usage.output_tokens;
    const costCents =
      ((inTok / 1_000_000) * INPUT_PER_MTOK + (outTok / 1_000_000) * OUTPUT_PER_MTOK) * 100;

    // Drop anything without a usable price — a row the human has to fix is
    // worse than one that was never offered.
    const items = (parsed.items ?? []).filter(
      (i) => typeof (i as { unit_price?: unknown }).unit_price === 'number'
    );

    return NextResponse.json({
      items,
      notes: parsed.notes ?? null,
      meta: {
        model: MODEL,
        input_tokens: inTok,
        output_tokens: outTok,
        cost_cents: Number(costCents.toFixed(4)),
      },
    });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    if (err.status === 429) {
      return NextResponse.json({ error: 'Rate limited — try again shortly.' }, { status: 429 });
    }
    console.error('[pricing/import]', err.message);
    return NextResponse.json({ error: err.message || 'Import failed' }, { status: 502 });
  }
}
