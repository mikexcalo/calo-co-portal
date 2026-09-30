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
 * all. The kit holds both; this hands over the PNG.
 *
 * WHY IT IS RESIZED HERE
 *
 * The kit's lockup is 2400px wide and 118 KB, and the signature draws it at
 * 120. Every recipient's mail client was fetching twenty times the pixels it
 * could use, on every first open of every message. This serves 240 - two
 * times the display size, which is what a retina screen actually asks for -
 * and the original stays untouched in the bucket for everything else.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { brandForOrg } from '@/lib/spine/brand-for-org';
import { SIGNATURE_DEFAULTS } from '@/lib/spine/signature-block';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/*
  Twice what the signature draws, derived rather than typed, so changing the
  display size in one place cannot leave the served file at the old scale.
*/
const SERVE_AT = SIGNATURE_DEFAULTS.logoWidth * 2;

export async function GET(req: NextRequest, { params }: { params: { org: string } }) {
  /*
    Which piece, and what it will sit on.

    Default is the stacked lockup for an email signature, which is what this
    route was built for. `part=mark` is the mark alone, for the 34px badge at
    the top of the sidebar - a lockup at that size is a smudge. `on` says
    which ground it has to read against, because the badge sits on the
    workspace's own colour and a white mark on a pale one is invisible.
  */
  const part = req.nextUrl.searchParams.get('part') === 'mark' ? 'mark' : 'lockup';
  const on = req.nextUrl.searchParams.get('on') === 'light' ? 'light' : 'dark';
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return new NextResponse('Not configured', { status: 500 });

  const db = createClient(url, key, { auth: { persistSession: false } });

  const facts = await brandForOrg(db, params.org);
  const wanted = part === 'mark'
    ? (on === 'dark' ? facts.markOnDark : facts.markOnLight)
    : facts.lockupPath;
  if (!wanted || !facts.assetPrefix) {
    return new NextResponse('No logo for this workspace', { status: 404 });
  }

  const { data, error } = await db.storage
    .from('client-assets')
    .download(`${facts.assetPrefix}/${wanted}`);
  if (error || !data) return new NextResponse('No logo for this workspace', { status: 404 });

  /*
    Never upscale. A kit whose lockup is already smaller than 240 is served as
    it is; blowing it up would cost bytes to add nothing.
  */
  const original = Buffer.from(await data.arrayBuffer());
  /* A badge is 34px drawn; 96 covers it at 2x with room for a bigger one. */
  const width = part === 'mark' ? 96 : SERVE_AT;
  let body: Buffer;
  try {
    body = await sharp(original)
      .resize({ width, withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toBuffer();
  } catch {
    /* A file sharp cannot read is still a logo somebody is waiting for. */
    body = original;
  }

  return new NextResponse(new Uint8Array(body), {
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
