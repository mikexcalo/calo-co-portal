import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // Support both { files: [...] } (multi) and { image: "..." } (legacy single)
    const fileList: string[] = body.files || (body.image ? [body.image] : []);

    if (!fileList.length) return NextResponse.json({ error: 'No files provided' }, { status: 400 });

    const apiKey = (process.env.CLAUDE_API_KEY || '').trim();
    if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 500 });

    const contentBlocks: any[] = [];
    for (const file of fileList) {
      const match = file.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) continue;
      const mediaType = match[1];
      const base64Data = match[2];
      if (mediaType === 'application/pdf') {
        contentBlocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } });
      } else if (mediaType.startsWith('image/')) {
        contentBlocks.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } });
      }
    }

    if (!contentBlocks.length) return NextResponse.json({ error: 'No valid files found' }, { status: 400 });

    contentBlocks.push({ type: 'text', text: `Extract invoice/receipt data from ALL of the provided documents and images. They are all related to the SAME invoice or transaction — combine the information from all sources into a single result. Return ONLY a JSON object with no markdown formatting, no backticks, no explanation. The JSON must have this exact structure:

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

If information appears in multiple documents, prefer the most detailed source. Combine line items from all sources — do not duplicate items that appear in multiple documents. Use "low" confidence if the user should review that field.` });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 2000, messages: [{ role: 'user', content: contentBlocks }] }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('[extract-receipt] API error:', response.status, errBody);
      return NextResponse.json({ error: 'AI extraction failed. Check API key and try again.' }, { status: 500 });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    const clean = text.replace(/```json\s*|```\s*/g, '').trim();
    return NextResponse.json(JSON.parse(clean));
  } catch (error: any) {
    console.error('Receipt extraction error:', error);
    return NextResponse.json({ error: error.message || 'Extraction failed' }, { status: 500 });
  }
}
