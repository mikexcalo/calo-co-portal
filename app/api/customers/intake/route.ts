/**
 * Everything you know about somebody, read off whatever you have.
 *
 * The case: you come back from a meeting with a photograph of a scribbled
 * page, a business card, and a price sheet, and the alternative is typing all
 * of it into four different screens. This reads one drop into a proposed
 * client, the people at it, and what they charge.
 *
 * IT PROPOSES. IT DOES NOT SAVE.
 *
 * Nothing here writes. The caller shows what was read, a person corrects it,
 * and only then is anything created. A wrong price that files itself is a
 * wrong estimate, then a wrong invoice, then a conversation with a customer
 * about why they were overcharged — and the cost of one extra click is
 * nothing against that.
 *
 * WHY THE COST IS BOUNDED
 * One Haiku call per drop, paid once at the moment it is dropped. There is
 * deliberately no way to ask follow-up questions about the document, which is
 * the same work charged again every time somebody is curious.
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const maxDuration = 90;

const MODEL = 'claude-haiku-4-5';
const IMAGES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;

export interface IntakeContact {
  name: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
}

export interface IntakePrice {
  name: string | null;
  unit: string | null;
  price: number | null;
}

export interface Intake {
  name: string | null;
  website: string | null;
  address: string | null;
  notes: string | null;
  contacts: IntakeContact[];
  prices: IntakePrice[];
}

const PROMPT =
  'This is something about a business somebody wants to record as a client — a photo of ' +
  'notes, a business card, a price sheet, an email, or several of those at once.\n\n' +
  'Return only JSON, no prose and no code fence, with exactly these keys:\n' +
  '  name     the business name, or null\n' +
  '  website  a domain if one is written down, or null\n' +
  '  address  a postal address if one is written down, or null\n' +
  '  notes    anything said about them that is worth keeping, in plain sentences, or null\n' +
  '  contacts an array of { name, title, email, phone }, one per person named. Empty if none.\n' +
  '  prices   an array of { name, unit, price }, one per line item on any price list. ' +
  'price is a number with no currency symbol. Empty if there is no price list.\n\n' +
  'Use null for anything not clearly there. Do not guess a company from an email domain, ' +
  'do not complete a partial phone number, and do not invent a price. Leaving a field empty ' +
  'is always better than filling it with something plausible.';

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Reading documents is not switched on yet.' }, { status: 503 });
  }

  let body: { data?: string; mediaType?: string; text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'That could not be read.' }, { status: 400 });
  }

  const { data, mediaType, text } = body;
  if (!data && !text?.trim()) {
    return NextResponse.json({ error: 'Drop a file, or paste some text.' }, { status: 400 });
  }
  if (data && data.length > 9_000_000) {
    return NextResponse.json({ error: 'That file is too big.' }, { status: 413 });
  }

  const content: Anthropic.MessageParam['content'] = [];
  if (data && mediaType === 'application/pdf') {
    content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } });
  } else if (data && IMAGES.includes(mediaType as (typeof IMAGES)[number])) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: mediaType as (typeof IMAGES)[number], data },
    });
  } else if (data) {
    return NextResponse.json({ error: 'Drop a PDF, a photo, or paste text.' }, { status: 400 });
  }
  if (text?.trim()) content.push({ type: 'text', text: text.slice(0, 20000) });
  content.push({ type: 'text', text: PROMPT });

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      messages: [{ role: 'user', content }],
    });

    const out = msg.content.find((c) => c.type === 'text');
    const raw = out && out.type === 'text' ? out.text.trim() : '';
    const json = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();

    let parsed: Partial<Intake>;
    try {
      parsed = JSON.parse(json) as Partial<Intake>;
    } catch {
      return NextResponse.json({ error: 'Nothing readable in that.' }, { status: 422 });
    }

    const intake: Intake = {
      name: parsed.name ?? null,
      website: parsed.website ?? null,
      address: parsed.address ?? null,
      notes: parsed.notes ?? null,
      contacts: Array.isArray(parsed.contacts)
        ? parsed.contacts.slice(0, 20).map((c) => ({
            name: c?.name ?? null, title: c?.title ?? null,
            email: c?.email ?? null, phone: c?.phone ?? null,
          }))
        : [],
      prices: Array.isArray(parsed.prices)
        ? parsed.prices.slice(0, 200).map((p) => ({
            name: p?.name ?? null, unit: p?.unit ?? null,
            price: typeof p?.price === 'number' ? p.price : null,
          }))
        : [],
    };

    const anything =
      intake.name || intake.website || intake.address || intake.notes ||
      intake.contacts.length || intake.prices.length;
    if (!anything) {
      return NextResponse.json({ error: 'Nothing about a business in that.' }, { status: 422 });
    }

    const usage = msg.usage;
    const cents =
      ((usage.input_tokens / 1_000_000) * 1.0 + (usage.output_tokens / 1_000_000) * 5.0) * 100;

    return NextResponse.json({ intake, cents: Math.round(cents * 100) / 100 });
  } catch {
    return NextResponse.json({ error: 'That could not be read. Try again.' }, { status: 502 });
  }
}
