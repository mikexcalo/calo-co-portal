import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { text, voice } = await req.json();

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'Text required' }, { status: 400 });
    }
    if (text.length > 4000) {
      return NextResponse.json({ error: 'Text too long (4000 char max)' }, { status: 400 });
    }

    const apiKey = (process.env.CLAUDE_API_KEY || '').trim();
    if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 500 });

    const v = voice || {};
    const toneList = (v.tones || []).sort((a: any, b: any) => a.priority - b.priority).map((t: any) => t.name).join(', ');

    const systemPrompt = `You are a writing assistant that rewrites text in a specific brand voice.

Brand voice:
- Tones (in priority order): ${toneList || 'professional, modern, approachable'}
- Target customer: ${v.targetCustomer || 'general business audience'}
- Elevator pitch: ${v.elevatorPitch || 'not specified'}
- Value propositions: ${(v.valueProps || []).join(', ') || 'not specified'}
- Key phrases to use naturally: ${(v.keyPhrases || []).join(', ') || 'none specified'}
- Phrases to avoid: ${(v.avoidPhrases || []).join(', ') || 'none specified'}
- Competitive differentiator: ${v.differentiator || 'not specified'}

Rewrite the user's text in this voice. Preserve the original meaning, structure, and approximate length. Adjust tone, vocabulary, and phrasing to match. Use key phrases naturally where they fit. Avoid prohibited phrases entirely. Return ONLY the rewritten text — no preamble, no explanation, no quotes around it, no markdown.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: text }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('[rewrite-voice] API error:', response.status, errBody);
      return NextResponse.json({ error: 'Translation failed' }, { status: 500 });
    }

    const data = await response.json();
    const rewritten = data?.content?.[0]?.text?.trim() || '';

    return NextResponse.json({ rewritten });
  } catch (err) {
    console.error('[rewrite-voice] error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
