/**
 * The enquiry endpoint.
 *
 * Thin on purpose: everything that matters, including the length caps and the
 * token lookup, happens in the database function. A public endpoint should
 * have as little logic of its own as possible, because logic here is logic
 * that has to be right in two places.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return NextResponse.json({ error: 'Not configured.' }, { status: 500 });

  let body: { token?: string; name?: string; email?: string; phone?: string; detail?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }

  const db = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await db.rpc('submit_enquiry', {
    t: body.token ?? '',
    who: body.name ?? '',
    contact_email: body.email ?? '',
    contact_phone: body.phone ?? '',
    detail: body.detail ?? '',
  });

  if (error) return NextResponse.json({ error: 'Could not send that.' }, { status: 502 });
  if (!data) return NextResponse.json({ error: 'Could not send that. Check the details and try again.' }, { status: 400 });
  return NextResponse.json({ ok: true });
}
