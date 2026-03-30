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
      text: `You are extracting invoice data from receipt screenshots. There may be multiple images from the same order — combine everything into one unified invoice.

EXTRACT ALL LINE ITEMS across all images. Every product/service with a name and price.

CRITICAL PRICE RULE: For prices, use the TOTAL AMOUNT per line item as shown on the receipt — do NOT divide by quantity. If the receipt shows "Qty: 1" and "$23.24", the price is 23.24. If the receipt shows "Qty: 250" and "$23.24", the price is STILL 23.24 (that's the total for that line), and qty is 1 (one order of 250 units). The qty field represents how many times this line item was ordered (usually 1), NOT the unit count. Unit counts go in the subtitle. Use the final/discounted price (the green/sale price), not the original strikethrough price.

For each line item return:
- description: product name + key details like size
- subtitle: e.g. "250 units · Custom printed, double-sided" or "5 units · Size XL · Custom branded"
- qty: number (usually 1 — this is how many times the line was ordered, NOT the unit count)
- price: number (the TOTAL price shown for this line item on the receipt)

Other fields:
- projectName: High-level summary — NOT a brand name. Examples: "Brand Merchandise — Spring 2026", "Custom Apparel Order". If items span categories, use a broad name.
- projectDescription: One-line summary like "Custom branded items ordered and fulfilled on behalf of client"
- tax: Extract as a number from the order summary, not from item lines.
- shipping: Extract as a number. If "FREE" or $0.00, return 0.
- notes: Leave empty unless there's a genuinely useful note (like a delivery date). Do NOT put subtotals, savings codes, or raw data here. Format delivery dates cleanly: "Expected delivery: April 8, 2026"

Return ONLY valid JSON, no markdown, no backticks:
{ "projectName": "...", "projectDescription": "...", "lineItems": [{ "description": "...", "subtitle": "...", "qty": 1, "price": 23.24 }], "tax": 7.92, "shipping": 0, "notes": "" }`,
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
