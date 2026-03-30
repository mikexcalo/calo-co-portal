import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, apiKey } = body;

    if (!apiKey) {
      return NextResponse.json({ type: 'query', answer: 'No API key provided. Add your Claude API key in Settings.' });
    }

    // Verify Supabase config
    if (!supabaseUrl || !supabaseKey) {
      console.error('[/api/chat] Missing Supabase env vars');
    }

    // Fetch ALL clients + contacts from Supabase
    const sb = createClient(supabaseUrl, supabaseKey);
    const [clientsRes, contactsRes] = await Promise.all([
      sb.from('clients').select('id, name, company, email, phone, website, address'),
      sb.from('contacts').select('id, client_id, name, role, email, phone, is_primary'),
    ]);

    if (clientsRes.error) console.error('[/api/chat] clients query failed:', clientsRes.error.message);
    if (contactsRes.error) console.error('[/api/chat] contacts query failed:', contactsRes.error.message);

    const clients = clientsRes.data || [];
    const contacts = contactsRes.data || [];

    const clientList = clients.map((c) => ({
      id: c.id,
      company: c.company || c.name,
      email: c.email,
      phone: c.phone,
      website: c.website,
      contacts: contacts.filter((ct) => ct.client_id === c.id).map((ct) => ({
        name: ct.name, role: ct.role, email: ct.email, phone: ct.phone, is_primary: ct.is_primary,
      })),
    }));

    console.log(`[/api/chat] Found ${clientList.length} clients. Message: "${message.substring(0, 80)}"`);

    const systemPrompt = `You are an AI assistant for CALO&CO, a creative agency run by Mike Calo.

Here are the current clients and their contacts:
${JSON.stringify(clientList, null, 2)}

RULES:
- Match ONLY against the client data above. Never guess or invent client names.
- Match against both company names AND contact names.
- If you can't find a match, ask which client they mean and list the available client names.

CLASSIFY every input:

1. task — action to take, follow up, send, create, call, email, schedule. Return: { "type": "task", "client_id": "id", "client_name": "company", "content": "description" }
2. note — reference info, preference, detail. Return: { "type": "note", "client_id": "id", "client_name": "company", "content": "content" }
3. query — question. Return: { "type": "query", "answer": "answer", "client_id": "id or null" }

If ambiguous task/note, default to task.
If no client match: { "type": "clarify", "message": "Which client? I have: ${clientList.map((c) => c.company).join(', ')}" }

Return ONLY valid JSON. No markdown, no code fences.`;

    // Make the Claude API call
    const anthropicResp = await fetch('https://api.anthropic.com/v1/messages', {
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

    if (!anthropicResp.ok) {
      const errBody = await anthropicResp.text();
      console.error(`[/api/chat] Claude API ${anthropicResp.status}:`, errBody);
      // Pass the actual error to the client for debugging
      let errMsg = `Claude API error (${anthropicResp.status})`;
      try {
        const errJson = JSON.parse(errBody);
        errMsg = errJson.error?.message || errMsg;
      } catch {}
      return NextResponse.json({ type: 'query', answer: `API error: ${errMsg}` });
    }

    const data = await anthropicResp.json();
    const text = data.content?.[0]?.text || '';
    console.log('[/api/chat] Response:', text.substring(0, 200));

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return NextResponse.json(JSON.parse(jsonMatch[0]));
      }
    } catch (e) {
      console.error('[/api/chat] JSON parse error:', e);
    }

    return NextResponse.json({ type: 'query', answer: text, client_id: null });
  } catch (e: any) {
    console.error('[/api/chat] Unhandled error:', e);
    return NextResponse.json({ type: 'query', answer: `Server error: ${e.message}` });
  }
}
