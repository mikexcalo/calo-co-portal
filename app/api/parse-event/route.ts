import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: Request) {
  try {
    const { text } = await request.json();

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const today = new Date().toISOString().split('T')[0];

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: `You parse free-form event descriptions into structured data. Today's date is ${today}.

Output ONLY a JSON object matching this exact shape, with no preamble, no code fences, no commentary:
{
  "title": string,
  "eventDate": string | null,
  "location": string | null,
  "description": string | null
}

Rules:
- For relative dates ("next Friday", "in 2 weeks"), resolve against today (${today}).
- For ambiguous dates (e.g. "May 2" with no year), assume the next future occurrence.
- Title should be concise (under 50 chars). Strip filler like "the" if it makes the title cleaner.
- Description holds anything that wasn't title/date/location. Keep it brief. NULL if nothing useful.
- If date is unclear, set eventDate to null. Better to flag uncertainty than guess.`,
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
      console.error('Failed to parse Claude response as JSON:', responseText);
      return NextResponse.json({
        error: 'Could not parse the response. Try rephrasing your description.'
      }, { status: 500 });
    }

    if (!parsed.title || typeof parsed.title !== 'string') {
      return NextResponse.json({
        error: 'Could not extract an event title from that text.'
      }, { status: 422 });
    }

    return NextResponse.json({
      title: parsed.title,
      eventDate: parsed.eventDate || null,
      location: parsed.location || null,
      description: parsed.description || null,
    });
  } catch (error: any) {
    console.error('Parse event error:', error);
    return NextResponse.json({
      error: error?.message || 'Something went wrong parsing the event.'
    }, { status: 500 });
  }
}
