/**
 * Where a scanned QR code lands.
 *
 * Counts the scan, then forwards. The person scanning never sees this — they
 * point a camera at a yard sign and arrive at the website, and the redirect
 * happens in the time it takes the page to start loading.
 *
 * Kept as short as it can be, because the address is printed inside the code
 * and a longer address means a denser pattern. A dense code on a sign read
 * from a moving car is a code that does not scan.
 *
 * Deliberately outside the sign-in wall. Somebody standing on a pavement
 * looking at a sign has no account and never will.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return NextResponse.redirect(new URL('/', req.url));

  const supabase = createClient(url, anon, { auth: { persistSession: false } });

  // The coarsest useful signal. A full user-agent string is a fingerprint;
  // "was this a phone" answers the only question worth asking about a code
  // printed on a sign.
  const ua = req.headers.get('user-agent') ?? '';
  const isMobile = /Mobile|Android|iPhone|iPad/i.test(ua);

  const { data, error } = await supabase.rpc('record_qr_scan', {
    scan_code: params.code,
    is_mobile: isMobile,
  });

  /**
   * An unknown or broken code still goes somewhere sensible. The code is
   * printed on something already in the world and cannot be corrected, so a
   * dead end is not an acceptable outcome — the site is.
   */
  if (error || !data) {
    return NextResponse.redirect('https://calo.company', { status: 302 });
  }

  // 302 rather than 301: a permanent redirect gets cached by the browser and
  // every scan after the first would never reach us to be counted.
  return NextResponse.redirect(data as string, { status: 302 });
}
