/**
 * A workspace's stacked logo, at an address that does not expire.
 *
 * WHY THIS EXISTS
 *
 * An email signature is read months after it was written, on machines that
 * have never heard of this product, by people who are not signed in to
 * anything. The logo in it has to be a plain `<img src>` that works forever.
 *
 * The kit's files live in `client-assets`, which is private on purpose: a
 * client's photography is not ours to publish, and some of it is not cleared.
 * The reader gets signed URLs that last an hour. Put one of those in a
 * signature and every email sent today has a broken image tomorrow.
 *
 * So this is the one door: a public URL that serves exactly one file per
 * workspace, the stacked lockup, and nothing else. It cannot be pointed at
 * another object in the bucket, because the path is not an input - it is
 * looked up from the brand kit for the org in the URL.
 *
 * WHY A PNG AND NOT THE SVG
 *
 * Outlook on Windows renders mail through Word, which does not draw SVG at
 * all. The kit holds both; this hands over the PNG, and the signature asks
 * for it at twice its display size so it stays sharp on a retina screen.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { brandForOrg } from '@/lib/spine/brand-for-org';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { org: string } }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return new NextResponse('Not configured', { status: 500 });

  const db = createClient(url, key, { auth: { persistSession: false } });

  const facts = await brandForOrg(db, params.org);
  if (!facts.lockupPath || !facts.assetPrefix) {
    return new NextResponse('No logo for this workspace', { status: 404 });
  }

  const { data, error } = await db.storage
    .from('client-assets')
    .download(`${facts.assetPrefix}/${facts.lockupPath}`);
  if (error || !data) return new NextResponse('No logo for this workspace', { status: 404 });

  return new NextResponse(await data.arrayBuffer(), {
    headers: {
      'content-type': 'image/png',
      /*
        A logo changes when a brand changes, which is rarely, and a mail
        client that caches it for a day is doing the recipient a favour.
      */
      'cache-control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800',
    },
  });
}
