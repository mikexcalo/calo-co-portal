import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { image } = await req.json();
    if (!image) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const match = image.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return NextResponse.json({ error: 'Invalid file format' }, { status: 400 });

    const mediaType = match[1];
    const base64Data = match[2];
    const isPdf = mediaType === 'application/pdf';
    const isImage = mediaType.startsWith('image/');

    if (!isPdf && !isImage) {
      return NextResponse.json({ error: 'Unsupported file type. Upload an image or PDF.' }, { status: 400 });
    }

    const apiKey = (process.env.CLAUDE_API_KEY || '').trim();
    if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 500 });

    const fileContent = isPdf
      ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64Data } }
      : { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp', data: base64Data } };

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
          content: [
            fileContent,
            { type: 'text', text: `Extract invoice/receipt data from this document. Return ONLY a JSON object with no markdown formatting, no backticks, no explanation. The JSON must have this exact structure:

{
  "vendor": "company name or empty string",
  "date": "YYYY-MM-DD or empty string",
  "lineItems": [
    { "description": "item description", "qty": 1, "rate": 0.00 }
  ],
  "subtotal": 0.00,
  "tax": 0.00,
  "total": 0.00,
  "notes": "any additional info like payment terms, PO numbers, account numbers",
  "confidence": {
    "vendor": "high",
    "date": "high",
    "lineItems": "high",
    "total": "high"
  }
}

If a field cannot be determined, use empty string or 0. The confidence field indicates how certain you are about each extraction. Use "low" if the user should definitely review that field.` },
          ],
        }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('[extract-receipt] API error:', response.status, errBody);
      return NextResponse.json({ error: 'AI extraction failed. Check API key and try again.' }, { status: 500 });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    const clean = text.replace(/```json\s*|```\s*/g, '').trim();
    const extracted = JSON.parse(clean);

    return NextResponse.json(extracted);
  } catch (error: any) {
    console.error('Receipt extraction error:', error);
    return NextResponse.json({ error: error.message || 'Extraction failed' }, { status: 500 });
  }
}
