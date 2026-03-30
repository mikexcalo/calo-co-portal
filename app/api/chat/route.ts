import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message } = body;

    // Read Claude API key from environment variable (set in Vercel)
    const rawKey = (process.env.CLAUDE_API_KEY || '').trim();

    if (!rawKey) {
      console.error('[/api/chat] CLAUDE_API_KEY env var is not set');
      return NextResponse.json({ type: 'query', answer: 'Claude API key not configured. Set CLAUDE_API_KEY in Vercel environment variables.' });
    }

    console.log(`[/api/chat] Key prefix: "${rawKey.substring(0, 10)}...", length: ${rawKey.length}`);

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

    if (clientsRes.error) console.error('[/api/chat] Failed to fetch clients:', JSON.stringify(clientsRes.error));
    if (contactsRes.error) console.error('[/api/chat] Failed to fetch contacts:', JSON.stringify(contactsRes.error));

    const clients = clientsRes.data || [];
    const contacts = contactsRes.data || [];

    console.log('[/api/chat] Clients found:', clients.length, JSON.stringify(clients.map((c) => c.company || c.name)));
    console.log('[/api/chat] Contacts found:', contacts.length);

    if (clients.length === 0) {
      console.error('[/api/chat] WARNING: Zero clients returned from Supabase. Check RLS policies or table data.');
    }

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

    const clientNames = clientList.map((c) => c.company).filter(Boolean);

    const systemPrompt = `You are an AI assistant for CALO&CO, a creative agency run by Mike Calo.

CURRENT CLIENTS IN THE SYSTEM:
${JSON.stringify(clientList, null, 2)}

CLIENT NAME LIST: ${clientNames.join(', ')}

MATCHING RULES:
- You MUST match user input against the client data above. Match against company names AND contact names within each client.
- Example: If a user says "Leandro", match to the client whose contacts array contains a person named "Leandro Gazolla" — that would be "LG Flooring Installation Co."
- Example: If a user says "Mammoth", match to "Mammoth Construction"
- Example: If a user says "Christina", match to the client whose contact is "Christina Lau"
- Never say you don't have clients. The data is listed above. There are ${clientList.length} clients.
- If you truly cannot match, respond: { "type": "clarify", "message": "Which client did you mean? I have: ${clientNames.join(', ')}" }

CLASSIFY every input:

1. task — action to take, follow up, send, create, call, email, schedule. Return: { "type": "task", "client_id": "the_uuid", "client_name": "company_name", "content": "description" }
2. note — reference info, preference, detail to remember. Return: { "type": "note", "client_id": "the_uuid", "client_name": "company_name", "content": "content" }
3. query — question about client data. Return: { "type": "query", "answer": "concise answer", "client_id": "uuid or null" }

If ambiguous between task/note, default to task.

Return ONLY valid JSON. No markdown, no code fences, no explanation — just the JSON object.`;

    console.log(`[/api/chat] System prompt length: ${systemPrompt.length} chars, client names: [${clientNames.join(', ')}]`);

    // Make the Claude API call
    const anthropicResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': rawKey,
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
