import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { content, sourceType } = await req.json();
    if (!content || content.length < 50) {
      return NextResponse.json({ error: 'Content too short — need at least 50 characters' }, { status: 400 });
    }

    const apiKey = (process.env.CLAUDE_API_KEY || '').trim();
    if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 500 });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `Analyze the following ${sourceType || 'content'} and extract a brand voice profile. Return ONLY a JSON object with no markdown, no backticks, no explanation.

Content to analyze:
"""
${content.slice(0, 8000)}
"""

Return this exact JSON structure:
{
  "tones": [
    { "name": "tone1", "priority": 1 },
    { "name": "tone2", "priority": 2 }
  ],
  "industry": "detected industry",
  "targetCustomer": "who this brand is talking to",
  "elevatorPitch": "1-2 sentence summary of what this company does",
  "valueProps": ["value prop 1", "value prop 2", "value prop 3"],
  "keyPhrases": ["phrase they use frequently", "another phrase"],
  "avoidPhrases": ["language they seem to avoid"],
  "differentiator": "what makes them unique based on the content",
  "confidence": "high",
  "reasoning": "1-2 sentence explanation of why you identified these patterns"
}

For tones, choose from: professional, casual, friendly, authoritative, warm, technical, bold. Pick 2-3 that best describe the communication style, ordered by dominance.`,
        }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('[analyze-voice] API error:', response.status, errBody);
      return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    const clean = text.replace(/```json\s*|```\s*/g, '').trim();
    const result = JSON.parse(clean);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Voice analysis error:', error);
    return NextResponse.json({ error: 'Analysis failed', details: error.message }, { status: 500 });
  }
}
