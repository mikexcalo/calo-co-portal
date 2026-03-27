import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

interface ExtractionResult {
  project_name?: string
  invoice_date?: string
  due_date?: string
  line_items?: Array<{
    description: string
    quantity: number
    price: number
  }>
  subtotal?: number
  tax?: number
  shipping?: number
  total?: number
  notes?: string
}

export async function POST(request: NextRequest) {
  try {
    const { imageBase64, mediaType } = await request.json()

    if (!imageBase64 || !mediaType) {
      return NextResponse.json(
        { error: 'Missing imageBase64 or mediaType' },
        { status: 400 }
      )
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY not configured' },
        { status: 500 }
      )
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: imageBase64,
                },
              },
              {
                type: 'text',
                text: `Extract invoice information from this image. Return a JSON object with the following fields (use null for missing data):
- project_name: The project or service name
- invoice_date: Date in YYYY-MM-DD format
- due_date: Date in YYYY-MM-DD format
- line_items: Array of {description: string, quantity: number, price: number}
- subtotal: Number
- tax: Number
- shipping: Number
- total: Number
- notes: Any additional notes or terms

Return ONLY valid JSON, no markdown or additional text.`,
              },
            ],
          },
        ],
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Claude API error:', error)
      return NextResponse.json(
        { error: 'Failed to extract data from image' },
        { status: 500 }
      )
    }

    const data = await response.json()
    const content = data.content[0]?.text || '{}'

    // Parse the JSON response
    let extractedData: ExtractionResult = {}
    try {
      extractedData = JSON.parse(content)
    } catch (parseError) {
      console.error('Failed to parse Claude response:', content)
      extractedData = {}
    }

    return NextResponse.json(extractedData)
  } catch (error) {
    console.error('Extract API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
