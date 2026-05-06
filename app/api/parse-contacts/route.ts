import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { text } = await request.json();

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      system: `You extract people from freeform notes, meeting recaps, or networking scribbles.

For each person mentioned, return structured data. Output ONLY a JSON object with no preamble, no code fences, no commentary:
{
  "contacts": [
    {
      "name": string,
      "role": string | null,
      "email": string | null,
      "phone": string | null,
      "kind": "lead" | "prospect" | "client_contact" | "talent" | "vendor" | "friend",
      "note": string | null
    }
  ]
}

Kind definitions:
- lead: someone you met casually, no commitment yet (DEFAULT when unclear)
- prospect: expressed interest in working together
- client_contact: already a client or part of a client org
- talent: creative for hire (photographer, designer, developer, etc.)
- vendor: service provider (printer, caterer, accountant, etc.)
- friend: personal connection, no business angle

Rules:
- Extract every distinct person mentioned.
- Name is required. Skip entries where you can't determine a name.
- Role/title: extract if mentioned (e.g. "runs a manufacturing shop" → "Manufacturing owner").
- Email/phone: extract only if explicitly mentioned. Do not guess.
- Note: one short sentence capturing the context of how/where they were mentioned. NULL if no useful context.
- Default kind to "lead" when the relationship type isn't clear.
- Do NOT invent people not mentioned in the text.`,
      messages: [
        { role: 'user', content: text }
      ]
    });

    const responseText = message.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('')
      .trim();

    let parsed;
    try {
      const cleaned = responseText.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('Failed to parse Claude contacts response as JSON:', responseText);
      return NextResponse.json({
        error: 'Could not parse the response. Try rephrasing your notes.'
      }, { status: 500 });
    }

    return NextResponse.json({
      contacts: Array.isArray(parsed.contacts) ? parsed.contacts : [],
    });
  } catch (error: any) {
    console.error('Parse contacts error:', error);
    return NextResponse.json({
      error: error?.message || 'Something went wrong parsing the contacts.'
    }, { status: 500 });
  }
}
