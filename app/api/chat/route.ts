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

    // Fetch ALL client data from Supabase
    const sb = createClient(supabaseUrl, supabaseKey);
    const [{ data: clients, error: clientsErr }, { data: contacts, error: contactsErr }] = await Promise.all([
      sb.from('clients').select('id, name, company, email, phone, website, address'),
      sb.from('contacts').select('id, client_id, name, role, email, phone, is_primary'),
    ]);

    if (clientsErr) console.error('[/api/chat] clients query error:', clientsErr.message);
    if (contactsErr) console.error('[/api/chat] contacts query error:', contactsErr.message);

    // Build structured client context
    const clientList = (clients || []).map((c) => {
      const cContacts = (contacts || []).filter((ct) => ct.client_id === c.id);
      return {
        id: c.id,
        company: c.company || c.name,
        email: c.email || null,
        phone: c.phone || null,
        website: c.website || null,
        address: c.address || null,
        contacts: cContacts.map((ct) => ({
          name: ct.name,
          role: ct.role || null,
          email: ct.email || null,
          phone: ct.phone || null,
          is_primary: ct.is_primary,
        })),
      };
    });

    const clientContextJson = JSON.stringify(clientList, null, 2);

    const systemPrompt = `You are an AI assistant for CALO&CO, a creative agency run by Mike Calo.

Here are the current clients and their contacts:
${clientContextJson}

RULES:
- When the user references a person or company, match ONLY against the client data above.
- Never guess or invent client names. If you can't find a match, ask which client they mean.
- Match against both company names AND contact names.

CLASSIFY every input into one of three types:

1. task — An action to take, something to do, follow up on, send, create, call, email, schedule. Return: { "type": "task", "client_id": "matched_id", "client_name": "matched company name", "content": "the task description" }

2. note — Reference info, a preference, a detail to remember. Return: { "type": "note", "client_id": "matched_id", "client_name": "matched company name", "content": "the note content" }

3. query — A question. Return: { "type": "query", "answer": "concise answer", "client_id": "id if relevant or null" }

If ambiguous between task/note, default to task.
If the input mentions a client you can't match: { "type": "clarify", "message": "Which client is this about? I have: [list client names]" }

ALWAYS return valid JSON only. No markdown, no code fences.`;

    // Log to verify client data is present
    console.log(`[/api/chat] System prompt includes ${clientList.length} clients. User message: "${message}"`);

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
      console.error('[/api/chat] Claude API error:', resp.status, errText);
      return NextResponse.json({ error: 'Claude API error' }, { status: 502 });
    }

    const data = await resp.json();
    const text = data.content?.[0]?.text || '';
    console.log('[/api/chat] Claude response:', text.substring(0, 200));

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return NextResponse.json(JSON.parse(jsonMatch[0]));
      }
    } catch (parseErr) {
      console.error('[/api/chat] JSON parse error:', parseErr);
    }

    return NextResponse.json({ type: 'query', answer: text, client_id: null });
  } catch (e: any) {
    console.error('[/api/chat] error:', e);
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 });
  }
}
