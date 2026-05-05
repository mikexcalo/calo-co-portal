import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { text } = await request.json();

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const today = new Date().toISOString().split('T')[0];

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      system: `You extract structured events and tasks from meeting transcripts or call notes. Today's date is ${today}.

Output ONLY a JSON object matching this exact shape, with no preamble, no code fences, no commentary:
{
  "events": [
    {
      "title": string,
      "eventDate": string | null,
      "location": string | null,
      "description": string | null
    }
  ],
  "tasks": [
    {
      "title": string,
      "dueDate": string | null,
      "leadDays": number | null,
      "anchorEventTitle": string | null
    }
  ]
}

Rules:
- Extract every distinct event and actionable task mentioned in the text.
- For events: pull title, date (YYYY-MM-DD), location, description.
- For tasks: pull title and either an explicit due_date (YYYY-MM-DD) OR an anchor to an event (anchorEventTitle = the exact title string you used for the matching event) plus leadDays (number of days before the event the task should be done). Only set one: dueDate OR (anchorEventTitle + leadDays).
- For relative dates ("next Friday", "in 2 weeks"), resolve against today (${today}).
- For ambiguous dates (e.g. "May 2" with no year), assume the next future occurrence.
- Keep titles concise (under 50 chars).
- If no events or tasks are found, return empty arrays.
- Do NOT invent items not mentioned in the text.
- If a date is unclear, set it to null.`,
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
      console.error('Failed to parse Claude transcript response as JSON:', responseText);
      return NextResponse.json({
        error: 'Could not parse the response. Try rephrasing or simplifying your notes.'
      }, { status: 500 });
    }

    return NextResponse.json({
      events: Array.isArray(parsed.events) ? parsed.events : [],
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
    });
  } catch (error: any) {
    console.error('Parse transcript error:', error);
    return NextResponse.json({
      error: error?.message || 'Something went wrong parsing the transcript.'
    }, { status: 500 });
  }
}
