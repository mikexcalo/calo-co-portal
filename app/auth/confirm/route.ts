/**
 * Where password resets, invites and magic links land.
 *
 * WHY THIS EXISTS AT ALL
 * Supabase's default emails link straight to its own domain — something like
 * qwncdybiluseypcovitd.supabase.co. The message says it is from calo.company
 * and the button goes to a random string on a domain nobody recognizes, which
 * is precisely the shape of a phishing email. Gmail agrees: the first reset we
 * sent was delivered to spam behind a red "this message might be dangerous"
 * banner.
 *
 * The fix is to send people to our own address instead. The email carries a
 * one-time token hash, this route exchanges it for a session, and the link the
 * recipient sees is on the same domain as the sender. No paid add-on required.
 *
 * The token is single-use and short-lived, and it is exchanged server-side, so
 * it never sits in browser history or gets handed to client JavaScript.
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next');

  if (!tokenHash || !type) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a context that cannot set cookies. Ignore.
          }
        },
      },
    }
  );

  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) {
    /**
     * Expired and already-used look identical from here, and both mean the
     * same thing to the person holding the link: ask for a new one. Saying
     * which would only be useful to somebody testing stolen links.
     */
    return NextResponse.redirect(`${origin}/login?error=expired`);
  }

  /**
   * A password reset lands on the security page, where there is somewhere to
   * actually set a new one. Everything else goes to the app.
   */
  const destination = next ?? (type === 'recovery' ? '/security?reset=1' : '/');
  return NextResponse.redirect(`${origin}${destination}`);
}
