/**
 * A note left on a preview by somebody with no account.
 *
 * The preview link is the credential. It names exactly one site, it is random,
 * and rotating it revokes every link that was ever sent. Everything written
 * below is pinned to the org that token resolves to, so a link grants notes on
 * the site the link was for and nothing else.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return NextResponse.json({ error: 'Not configured.' }, { status: 500 });

  let body: { token?: string; sectionId?: string | null; author?: string; body?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }

  const text = (body.body ?? '').trim();
  if (!text) return NextResponse.json({ error: 'Say something first.' }, { status: 400 });
  // Capped rather than truncated: silently losing the end of somebody's note is
  // worse than telling them it was too long.
  if (text.length > 2000) return NextResponse.json({ error: 'That is longer than a note. Cut it down or send an email.' }, { status: 400 });

  const db = createClient(url, service, {
    auth: { persistSession: false },
    global: { fetch: (i, init) => fetch(i, { ...init, cache: 'no-store' }) },
  });

  const { data: org } = await db
    .from('orgs')
    .select('id')
    .eq('site_preview_token', (body.token ?? '').trim())
    .maybeSingle();
  if (!org) return NextResponse.json({ error: 'That link is not valid.' }, { status: 404 });

  /**
   * The section has to belong to this token's site.
   *
   * The id arrives from the browser, so without this check a valid link to one
   * site could be used to leave notes on another org's sections.
   */
  let sectionId: string | null = null;
  if (body.sectionId) {
    const { data: sec } = await db
      .from('site_sections')
      .select('id')
      .eq('id', body.sectionId)
      .eq('org_id', org.id)
      .maybeSingle();
    if (!sec) return NextResponse.json({ error: 'That section is not on this site.' }, { status: 400 });
    sectionId = sec.id;
  }

  const { error } = await db.from('site_feedback').insert({
    org_id: org.id,
    section_id: sectionId,
    author: (body.author ?? '').trim().slice(0, 80) || null,
    body: text,
  });
  if (error) return NextResponse.json({ error: 'Could not save that.' }, { status: 500 });

  return NextResponse.json({ ok: true });
}
