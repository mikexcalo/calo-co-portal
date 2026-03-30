import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const apiKey = (process.env.CLAUDE_API_KEY || '').trim();
    if (!apiKey) {
      return NextResponse.json({ error: 'CLAUDE_API_KEY not configured' }, { status: 500 });
    }

    const { images } = await req.json();
    // images: Array<{ base64: string, mediaType: string }>
    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: 'No image data provided' }, { status: 400 });
    }

    // Build content blocks: one image block per uploaded file, then the text prompt
    const contentBlocks: any[] = [];
    for (const img of images) {
      contentBlocks.push({
        type: 'image',
        source: { type: 'base64', media_type: img.mediaType || 'image/png', data: img.base64 },
      });
    }

    contentBlocks.push({
      type: 'text',
      text: `You are extracting invoice data from receipt screenshots. There may be multiple images from the same order — combine everything into one invoice.

Extract ALL line items across all images. Every product/service with a name, quantity, and price. Use the final/discounted price (the green/sale price), not the original strikethrough price.

For each line item, return:
- description: product name + key details like size
- subtitle: e.g. "250 units · Custom printed, double-sided" or "5 units · Size XL · Custom branded"
- qty: number
- price: number (the per-unit final price)

Other fields:
- projectName: Generate a high-level summary — NOT a brand name. Examples: "Brand Merchandise — Spring 2026", "Custom Apparel Order". If items span categories (apparel + print), use a broad name.
- projectDescription: One-line summary like "Custom branded items ordered and fulfilled on behalf of client"
- tax: Extract as a number from the order summary, not from item lines.
- shipping: Extract as a number. If "FREE" or $0.00, return 0.
- notes: Leave empty unless there's a genuinely useful note (like a delivery date). Do NOT put subtotals, savings codes, or raw order data here. If there's a delivery date, format it cleanly: "Expected delivery: April 8, 2026"

Return ONLY valid JSON, no markdown, no backticks:
{ "projectName": "...", "projectDescription": "...", "lineItems": [{ "description": "...", "subtitle": "...", "qty": 1, "price": 16.86 }], "tax": 7.92, "shipping": 0, "notes": "" }`,
    });

    console.log(`[/api/ocr] Processing ${images.length} image(s)`);

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{ role: 'user', content: contentBlocks }],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('[/api/ocr] Claude error:', resp.status, errText);
      return NextResponse.json({ error: 'OCR extraction failed' }, { status: 502 });
    }

    const data = await resp.json();
    const text = data.content?.[0]?.text || '';
    console.log('[/api/ocr] Response length:', text.length);

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
