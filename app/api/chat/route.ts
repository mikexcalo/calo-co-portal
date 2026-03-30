import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: NextRequest) {
  try {
    const { message, apiKey } = await req.json();

    if (!apiKey) {
      return NextResponse.json({ error: 'No API key provided' }, { status: 400 });
    }

    // Fetch client data from Supabase for context
    const sb = createClient(supabaseUrl, supabaseKey);
    const [{ data: clients }, { data: contacts }] = await Promise.all([
      sb.from('clients').select('id, name, company, email, phone, website, address'),
      sb.from('contacts').select('id, client_id, name, role, email, phone, is_primary'),
    ]);

    // Build context string
    const clientContext = (clients || []).map((c) => {
      const cContacts = (contacts || []).filter((ct) => ct.client_id === c.id);
      const contactStr = cContacts.map((ct) =>
        `${ct.name}${ct.role ? ` (${ct.role})` : ''} — ${ct.email || 'no email'}, ${ct.phone || 'no phone'}${ct.is_primary ? ' [primary]' : ''}`
      ).join('; ');
      return `Client: "${c.company || c.name}" (id: ${c.id}) — email: ${c.email || '—'}, phone: ${c.phone || '—'}, website: ${c.website || '—'}, address: ${c.address || '—'}. Contacts: ${contactStr || 'none'}`;
    }).join('\n');

    const systemPrompt = `You are an AI assistant for CALO&CO, a creative agency. You have access to client data.

INSTRUCTIONS:
1. Classify every input as either a "query" (user wants to look up or ask about client data) or a "note" (user wants to save a note/observation about a client).
2. For queries: Return a JSON object: { "type": "query", "answer": "concise answer with relevant data", "client_id": "id if relevant or null" }
3. For notes: Extract the client reference from the text (match against client and contact names). Return: { "type": "note", "client_id": "matched_client_id", "client_name": "matched name", "content": "the note content" }
4. If ambiguous whether it's a note or query: Return { "type": "clarify", "message": "your clarifying question" }
5. If a note mentions a client but you can't match it: Return { "type": "clarify", "message": "Which client is this about?" }

ALWAYS return valid JSON. No markdown, no code fences — just the JSON object.

CLIENT DATA:
${clientContext}`;

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
        system: systemPrompt,
        messages: [{ role: 'user', content: message }],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('[/api/chat] Claude API error:', errText);
      return NextResponse.json({ error: 'Claude API error' }, { status: 502 });
    }

    const data = await resp.json();
    const text = data.content?.[0]?.text || '';

    // Parse JSON from response
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return NextResponse.json(parsed);
      }
    } catch {}

    // Fallback: treat as query answer
    return NextResponse.json({ type: 'query', answer: text, client_id: null });
  } catch (e: any) {
    console.error('[/api/chat] error:', e);
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 });
  }
}
