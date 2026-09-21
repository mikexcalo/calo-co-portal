/**
 * Reading a person off a picture.
 *
 * The case: somebody sends you a screenshot of a signature block, a photo of
 * a business card, a LinkedIn header. Every field you need is sitting in that
 * image and typing it out again is the lookup the product should be doing.
 *
 * WHAT IT COSTS
 * One call per image, on Haiku, paid once at the moment you drop it. A
 * screenshot is a few hundred tokens in and well under a hundred out — a
 * fraction of a cent. There is deliberately no "ask a question about this
 * contact" feature, which is the same work charged again every time somebody
 * is curious.
 *
 * It proposes. Everything it reads lands in the form for a person to correct
 * before anything is saved, because a misread phone number that saves itself
 * is worse than no phone number.
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MODEL = 'claude-haiku-4-5';
const SUPPORTED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;

interface Read {
  name: string | null;
  title: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
}

const EMPTY: Read = { name: null, title: null, company: null, email: null, phone: null, website: null };

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Reading images is not switched on yet.' }, { status: 503 });
  }

  let body: { data?: string; mediaType?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'That file could not be read.' }, { status: 400 });
  }

  const { data, mediaType } = body;
  if (!data || !mediaType || !SUPPORTED.includes(mediaType as (typeof SUPPORTED)[number])) {
    return NextResponse.json({ error: 'Drop a PNG, JPG, GIF or WEBP.' }, { status: 400 });
  }
  // Roughly 5MB of base64. Bigger than any screenshot, smaller than a problem.
  if (data.length > 7_000_000) {
    return NextResponse.json({ error: 'That image is too big.' }, { status: 413 });
  }

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 400,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType as (typeof SUPPORTED)[number],
                data,
              },
            },
            {
              type: 'text',
              text:
                'Read the contact details out of this image. Return only JSON with exactly these keys: ' +
                'name, title, company, email, phone, website. ' +
                'Use null for anything not clearly visible — do not guess, do not infer a company from an ' +
                'email domain, and do not complete a partial phone number. Keep the phone number formatted ' +
                'as it appears. No prose, no code fence.',
            },
          ],
        },
      ],
    });

    const text = msg.content.find((c) => c.type === 'text');
    const raw = text && text.type === 'text' ? text.text.trim() : '';
    const json = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();

    let read: Read = EMPTY;
    try {
      const parsed = JSON.parse(json) as Partial<Read>;
      read = {
        name: parsed.name ?? null,
        title: parsed.title ?? null,
        company: parsed.company ?? null,
        email: parsed.email ?? null,
        phone: parsed.phone ?? null,
        website: parsed.website ?? null,
      };
    } catch {
      return NextResponse.json({ error: 'Nothing readable in that image.' }, { status: 422 });
    }

    const found = Object.values(read).filter(Boolean).length;
    if (!found) {
      return NextResponse.json({ error: 'No contact details in that image.' }, { status: 422 });
    }

    return NextResponse.json({ read, found });
  } catch {
    return NextResponse.json({ error: 'That image could not be read. Try again.' }, { status: 502 });
  }
}
