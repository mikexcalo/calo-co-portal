import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const fileList: string[] = body.files || (body.image ? [body.image] : []);

    if (!fileList.length) return NextResponse.json({ error: 'No files provided' }, { status: 400 });

    const apiKey = (process.env.CLAUDE_API_KEY || '').trim();
    if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 500 });

    // Dedupe identical files by base64 content
    const uniqueFiles = Array.from(new Set(fileList));
    const dupesRemoved = fileList.length - uniqueFiles.length;

    // Process one file with up to 1 retry on failure
    const extractSingle = async (file: string, attempt: number = 0): Promise<any | null> => {
      const match = file.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) return null;
      const mediaType = match[1];
      const base64Data = match[2];

      let fileBlock: any = null;
      if (mediaType === 'application/pdf') {
        fileBlock = { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } };
      } else if (mediaType.startsWith('image/')) {
        fileBlock = { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } };
      }
      if (!fileBlock) return null;

      const promptBlock = {
        type: 'text',
        text: `Extract invoice/receipt data from this single document. Return ONLY a JSON object with no markdown, no backticks, no explanation.

Structure:
{
  "vendor": "company name or empty string",
  "invoiceNumber": "invoice number or empty string",
  "orderNumber": "order number or empty string",
  "date": "YYYY-MM-DD or empty string",
  "lineItems": [
    { "description": "item description exactly as written", "qty": 1, "rate": 0.00 }
  ],
  "subtotal": 0.00,
  "tax": 0.00,
  "total": 0.00
}

Rules:
- Include EVERY line item exactly as it appears, including service fees, processing fees, etc.
- Use the exact description text from the document.
- Numbers must be numeric, not strings.
- If a field is missing, use empty string or 0.`
      };

      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 2000,
            messages: [{ role: 'user', content: [fileBlock, promptBlock] }]
          }),
        });

        if (!response.ok) {
          const errBody = await response.text();
          console.error(`[extract-receipt] attempt ${attempt + 1} failed:`, response.status, errBody);
          if (attempt === 0) {
            await new Promise(r => setTimeout(r, 500));
            return extractSingle(file, 1);
          }
          return null;
        }

        const data = await response.json();
        const text = data.content?.[0]?.text || '';
        const clean = text.replace(/```json\s*|```\s*/g, '').trim();
        return JSON.parse(clean);
      } catch (e) {
        console.error(`[extract-receipt] attempt ${attempt + 1} exception:`, e);
        if (attempt === 0) {
          await new Promise(r => setTimeout(r, 500));
          return extractSingle(file, 1);
        }
        return null;
      }
    };

    // Run all extractions in parallel
    const results = await Promise.all(uniqueFiles.map(f => extractSingle(f)));
    const valid = results.filter((r): r is any => r !== null);
    const failed = uniqueFiles.length - valid.length;

    if (!valid.length) {
      return NextResponse.json({ error: 'Could not extract data from any of the uploaded files.' }, { status: 500 });
    }

    // Merge results
    const merged = {
      vendor: valid.find((r: any) => r.vendor)?.vendor || '',
      date: valid
        .map((r: any) => r.date)
        .filter(Boolean)
        .sort()[0] || '',
      lineItems: valid.flatMap((r: any) => Array.isArray(r.lineItems) ? r.lineItems : []),
      subtotal: Number(valid.reduce((s: number, r: any) => s + (Number(r.subtotal) || 0), 0).toFixed(2)),
      tax: Number(valid.reduce((s: number, r: any) => s + (Number(r.tax) || 0), 0).toFixed(2)),
      total: Number(valid.reduce((s: number, r: any) => s + (Number(r.total) || 0), 0).toFixed(2)),
      notes: valid
        .map((r: any) => {
          const parts: string[] = [];
          if (r.invoiceNumber) parts.push(`Invoice ${r.invoiceNumber}`);
          if (r.date) parts.push(`dated ${r.date}`);
          if (r.orderNumber) parts.push(`Order ${r.orderNumber}`);
          if (r.total) parts.push(`total $${Number(r.total).toFixed(2)}`);
          return parts.join(', ');
        })
        .filter(Boolean)
        .join('; '),
      filesSubmitted: fileList.length,
      filesProcessed: valid.length,
      filesFailed: failed,
      duplicatesRemoved: dupesRemoved,
      confidence: {
        vendor: 'high',
        date: 'high',
        lineItems: failed === 0 ? 'high' : 'low',
        total: failed === 0 ? 'high' : 'low'
      }
    };

    return NextResponse.json(merged);
  } catch (error: any) {
    console.error('Receipt extraction error:', error);
    return NextResponse.json({ error: error.message || 'Extraction failed' }, { status: 500 });
  }
}
