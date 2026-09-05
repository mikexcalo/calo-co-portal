/**
 * The card as a file their phone understands.
 *
 * A link they have to remember to open again is not a contact. vCard is the
 * one format both phones open straight into Contacts, so this generates it
 * from the same row the page renders and hands it over with a filename their
 * OS will keep.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** vCard is line based, so a stray newline in a field would break the file. */
const clean = (v: string | null | undefined) =>
  (v ?? '').replace(/[\r\n]+/g, ' ').replace(/;/g, '\;').replace(/,/g, '\\,').trim();

export async function GET(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const slug = req.nextUrl.searchParams.get('slug') ?? '';
  if (!url || !service || !slug) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const db = createClient(url, service, {
    auth: { persistSession: false },
    global: { fetch: (i, init) => fetch(i, { ...init, cache: 'no-store' }) },
  });
  const { data: c } = await db
    .from('cards')
    .select('name, title, company, email, phone, website, tagline')
    .eq('slug', slug)
    .eq('live', true)
    .maybeSingle();
  if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const parts = c.name.trim().split(/\s+/);
  const last = parts.length > 1 ? parts.pop() : '';
  const first = parts.join(' ');

  const vcf = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${clean(last)};${clean(first)};;;`,
    `FN:${clean(c.name)}`,
    c.company ? `ORG:${clean(c.company)}` : '',
    c.title ? `TITLE:${clean(c.title)}` : '',
    c.email ? `EMAIL;TYPE=WORK:${clean(c.email)}` : '',
    c.phone ? `TEL;TYPE=CELL:${clean(c.phone)}` : '',
    c.website ? `URL:${clean(c.website)}` : '',
    c.tagline ? `NOTE:${clean(c.tagline)}` : '',
    'END:VCARD',
  ].filter(Boolean).join('\r\n');

  return new NextResponse(vcf, {
    headers: {
      'Content-Type': 'text/vcard; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slug}.vcf"`,
      'Cache-Control': 'no-store',
    },
  });
}
