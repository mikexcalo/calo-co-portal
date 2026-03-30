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

    const sb = createClient(supabaseUrl, supabaseKey);
    const [{ data: clients }, { data: contacts }] = await Promise.all([
      sb.from('clients').select('id, name, company, email, phone, website, address'),
      sb.from('contacts').select('id, client_id, name, role, email, phone, is_primary'),
    ]);

    const clientContext = (clients || []).map((c) => {
      const cContacts = (contacts || []).filter((ct) => ct.client_id === c.id);
      const contactStr = cContacts.map((ct) =>
        `${ct.name}${ct.role ? ` (${ct.role})` : ''} — ${ct.email || 'no email'}, ${ct.phone || 'no phone'}${ct.is_primary ? ' [primary]' : ''}`
      ).join('; ');
      return `Client: "${c.company || c.name}" (id: ${c.id}) — email: ${c.email || '—'}, phone: ${c.phone || '—'}, website: ${c.website || '—'}, address: ${c.address || '—'}. Contacts: ${contactStr || 'none'}`;
    }).join('\n');

    const systemPrompt = `You are an AI assistant for CALO&CO, a creative agency. You have access to client data.

CLASSIFY every input into one of three types:

1. **task** — The input describes an action to take, something to do, follow up on, send, create, schedule, remind, call, email, etc. Return: { "type": "task", "client_id": "matched_id", "client_name": "matched name", "content": "the task description" }

2. **note** — The input is reference information, a preference, a detail to remember, an observation. Return: { "type": "note", "client_id": "matched_id", "client_name": "matched name", "content": "the note content" }

3. **query** — The input is a question about client data. Return: { "type": "query", "answer": "concise answer", "client_id": "id if relevant or null" }

RULES:
- Match client references against both company names and contact names in the data below.
- If you can't determine task vs note, default to task (better to have a checkable item).
- If the input mentions a client you can't match: { "type": "clarify", "message": "Which client is this about?" }
- If truly ambiguous and unclassifiable: { "type": "clarify", "message": "your clarifying question" }

ALWAYS return valid JSON only. No markdown, no code fences.

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

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return NextResponse.json(JSON.parse(jsonMatch[0]));
      }
    } catch {}

    return NextResponse.json({ type: 'query', answer: text, client_id: null });
  } catch (e: any) {
    console.error('[/api/chat] error:', e);
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 });
  }
}
