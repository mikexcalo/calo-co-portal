import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const apiKey = (process.env.CLAUDE_API_KEY || '').trim();
    if (!apiKey) {
      return NextResponse.json({ error: 'CLAUDE_API_KEY not configured' }, { status: 500 });
    }

    const { imageBase64, mediaType } = await req.json();
    if (!imageBase64) {
      return NextResponse.json({ error: 'No image data' }, { status: 400 });
    }

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/png', data: imageBase64 } },
            { type: 'text', text: 'Extract invoice/receipt details. Return ONLY JSON: { "vendor": "", "items": [{"description": "", "qty": 1, "price": 0}], "tax": 0, "shipping": 0, "total": 0, "notes": "" }' },
          ],
        }],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('[/api/ocr] Claude error:', resp.status, errText);
      return NextResponse.json({ error: 'OCR extraction failed' }, { status: 502 });
    }

    const data = await resp.json();
    const text = data.content?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return NextResponse.json(JSON.parse(jsonMatch[0]));
    }
    return NextResponse.json({ error: 'Could not parse extraction result' }, { status: 422 });
  } catch (e: any) {
    console.error('[/api/ocr] error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
