/**
 * "This one is for you."
 *
 * A drop could be filed against a person or a customer and nothing else, so
 * there was no way to say the thing every client eventually wants to say:
 * this is not about one of my customers, it is for whoever runs my website.
 *
 * John wrote a page of notes about his site, found nowhere to put them, and
 * emailed them instead — which is the behaviour this product exists to remove.
 *
 * It lands in the agency's Asked for, with the file still attached to the drop
 * so nothing has to be re-uploaded or re-explained.
 */

import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { apiError } from '@/lib/spine/errors';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !key) {
    return NextResponse.json({ error: 'Server is not configured' }, { status: 500 });
  }

  const store = cookies();
  const asCaller = createServerClient(url, anon, {
    cookies: { get: (n: string) => store.get(n)?.value, set: () => {}, remove: () => {} },
  });
  const { data: auth } = await asCaller.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const { dropId, note } = (await req.json()) as { dropId?: string; note?: string };
  if (!dropId) return NextResponse.json({ error: 'Missing' }, { status: 400 });

  const db = createClient(url, key, { auth: { persistSession: false } });

  const { data: drop } = await db
    .from('drops')
    .select('id, org_id, title, body, kind, storage_path')
    .eq('id', dropId)
    .maybeSingle();
  if (!drop?.org_id) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  // It has to be theirs before it can be handed anywhere.
  const { data: member } = await db
    .from('memberships')
    .select('id')
    .eq('user_id', auth.user.id)
    .eq('org_id', drop.org_id)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const { data: org } = await db.from('orgs').select('name').eq('id', drop.org_id).maybeSingle();

  /*
    Whoever looks after this business.

    There is no "my agency" field on an org, and there does not need to be: the
    agency already holds a customer record pointing at this workspace, which is
    what makes the billing read-through work. Read it backwards and you have
    the answer.

    Falls back to the business itself, so a workspace nobody manages files the
    request somewhere a person still reads rather than dropping it.
  */
  const { data: heldBy } = await db
    .from('customers')
    .select('org_id')
    .eq('linked_org_id', drop.org_id)
    .limit(1)
    .maybeSingle();

  const goesTo = heldBy?.org_id ?? drop.org_id;

  const what = drop.title || (drop.body ?? '').slice(0, 140) || 'A file';

  const { error } = await db.from('feedback').insert({
    org_id: goesTo,
    kind: 'request',
    body: [
      `${org?.name ?? 'A client'} sent this over:`,
      '',
      what,
      note?.trim() ? `\n"${note.trim()}"` : null,
      '',
      'It is on their Drops, still attached.',
    ].filter((l) => l !== null).join('\n'),
    page: '/inbox',
    status: 'open',
  });
  if (error) return NextResponse.json(apiError('drops/hand-over', error), { status: 500 });

  await db.from('notifications').insert({
    org_id: goesTo,
    kind: 'system',
    title: `${org?.name ?? 'A client'} sent you something`,
    body: what,
  }).then(undefined, () => {});

  await db.from('drops').update({ filed_at: new Date().toISOString() }).eq('id', dropId);

  return NextResponse.json({ ok: true });
}
