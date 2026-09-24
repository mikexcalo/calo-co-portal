import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * The assurance level of the current session — 'aal1' after a password,
 * 'aal2' once a second factor has been accepted.
 *
 * Read off the token rather than asked for, because asking costs a round
 * trip on every request. Safe to read unverified here: this only decides
 * which screen someone sees. The database checks the same claim after
 * verifying the signature, and that is the check that guards the data.
 */
async function sessionAal(
  supabase: ReturnType<typeof createServerClient>
): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return 'aal1';
  try {
    const payload = token.split('.')[1];
    const json = JSON.parse(
      Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    );
    return typeof json.aal === 'string' ? json.aal : 'aal1';
  } catch {
    // An unreadable token is not a pass. Treat it as the lower level and let
    // the person sign in again.
    return 'aal1';
  }
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  /**
   * The card host is entirely public.
   *
   * Middleware runs before the rewrites in next.config, so on
   * card.calo.company it sees /mike rather than /c/mike and bounced a stranger
   * with a phone camera to a sign-in screen. Checked by host rather than by
   * path, because every path on that host is a card.
   */
  const host = request.headers.get('host') ?? '';
  if (host === 'card.calo.company') return NextResponse.next();
  // /trust is readable signed out on purpose — the person who needs
  // convincing hasn't got an account yet.
  const isPublic =
    path.startsWith('/login') ||
    path.startsWith('/welcome') ||
    path.startsWith('/trust') ||
    // A site preview is a link you send to somebody who has no account. That
    // is the entire point of it, so it cannot sit behind a session.
    path.startsWith('/preview/');

  // Not logged in → redirect to /login (unless already there)
  // Deliberately not `!isPublic`: /welcome is in that list for a different
  // reason and has always redirected a signed-out visitor to the login screen.
  if (
    !user &&
    !path.startsWith('/login') &&
    !path.startsWith('/trust') &&
    !path.startsWith('/preview/')
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  /**
   * One profile fetch answers both questions this function has left: does
   * this person have a profile, and do they owe a second factor. Kept to a
   * single query on purpose — this runs on every request, and the last
   * outage on this project was middleware waiting on Supabase until Vercel
   * gave up at 25 seconds.
   */
  /*
    Skipped once we have seen it, which is almost every request.

    This is a database round trip on every page load, for every signed-in
    person, to read one flag that changes about once in an account's life.
    Combined with the getUser() above it meant two network hops before any
    page began rendering — and db.ts already learned this lesson, in a comment
    that says a round trip per call "is the whole of why the app got slow".

    Two facts are needed: does a profile exist, and is two-factor on. Both are
    stable, so the first time they are read they go in a cookie and the query
    stops running. The cookie decides nothing on its own — every read is still
    filtered by current_org_id() server-side, and the worst a forged value
    buys is skipping a redirect to a setup screen.
  */
  /*
    Only the safe state is cached.

    Two things could be remembered here and only one of them is safe to get
    wrong. If the cookie said "two-factor is on" and it had since been turned
    off, mfaPending would be true forever and the person would be bounced to
    /login on every request — a lockout, caused by a cache.

    The other way round is harmless: a stale "off" skips a redirect, and
    current_org_id() still refuses to return anything until the second step is
    done, because it checks the assurance level server-side where the
    signature has been verified. So the app looks empty rather than open.

    So: cache only "profile exists, two-factor off". Anyone with two-factor on
    pays the query every time, which is correct and rare.
  */
  const seen = request.cookies.get('nautilus_p')?.value;
  let profile: { id: string; mfa_enabled: boolean | null } | null = null;
  let learned = false;

  if (user && seen === '1') {
    profile = { id: user.id, mfa_enabled: false };
  } else if (user) {
    profile = (
      await supabase.from('profiles').select('id, mfa_enabled').eq('id', user.id).maybeSingle()
    ).data;
    learned = true;
  }

  /**
   * Owes a code: two-factor is on, but this session never finished the
   * second step.
   *
   * Worked out before anything routes on it, because the two rules below
   * disagree about where such a session belongs — "you're logged in" wants
   * the dashboard, the second-factor rule wants the sign-in screen — and in
   * the wrong order they bounce it between the two forever.
   *
   * Reading the assurance level straight off the token is fine here even
   * though a token is attacker-controlled in principle: the worst a forged
   * claim buys is the right to look at an empty app. current_org_id() is
   * what actually decides, and it checks the same claim server-side where
   * the signature has been verified.
   */
  const mfaPending = !!profile?.mfa_enabled && (await sessionAal(supabase)) !== 'aal2';

  // Logged in but on /login → the dashboard. Unless the second step is still
  // outstanding, in which case /login is exactly where they belong.
  if (user && !mfaPending && path.startsWith('/login')) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  if (mfaPending && !path.startsWith('/login')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('mfa', '1');
    return NextResponse.redirect(url);
  }

  // Logged in with no profile → set one up.
  if (user && !isPublic && !profile) {
    const url = request.nextUrl.clone();
    url.pathname = '/welcome';
    return NextResponse.redirect(url);
  }

  /* Remember what we just paid a query for, so the next request does not. */
  if (learned && profile && !profile.mfa_enabled) {
    supabaseResponse.cookies.set('nautilus_p', '1', {
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: 60 * 60 * 12,
    });
  }

  return supabaseResponse;
}

/*
  A public document can only call a public endpoint.

  /e/[token] posts to two routes: decide, which was on this list, and note,
  which was not. So "Ask about this" on a proposal returned a 307 to the login
  page for every client who tried it — which is every client, because a
  proposal is read without an account. It has never worked.

  Both are gated the same way, on the document's own token, which is the same
  credential that let them read it in the first place. Anything /e or /i calls
  belongs here; this is the second time a missing entry has silently broken a
  client-facing feature, the first being the auth routes that stopped anybody
  resetting a password.
*/
export const config = {
  matcher: [
    /*
     * Match all routes EXCEPT:
     * - _next/static, _next/image (Next.js internals)
     * - favicon.ico, favicon.svg, images, videos (static assets)
     * - /api/leads/ingest      public lead capture
     * - /api/estimates/decide   customer accepting a quote, no account
     * - /api/public/            published price feeds
     * - /api/calendar/          calendar subscriptions
     * - /api/stripe/webhook     Stripe calling us
     * - /q/                     a scanned QR code, forwarded onward
     * - /p/                     a pitch, read by whoever holds the link
     * - /e/                     the customer-facing estimate page
     * - /i/                     the customer-facing invoice page
     * - /s/                     a published case study
     * - /r/                     a review link, followed by a customer
     * - /new/                   the public enquiry form
     * - /api/enquiry            that form posting
     * - /t.js                   the tracker, loaded by somebody else's site
     * - /api/track              that tracker reporting an event
     * - /api/preview/           a note left on a preview by somebody with no
     *                           account, which is the entire point of it
     * - /c/                     a digital business card, scanned by a stranger
     * - /api/card/              that card as a vCard file
     * - /api/version            which commit is live, so a stale deploy can be
     *                           told apart from a bug
     * - /api/cron/              Vercel's scheduler, which carries no session
     *
     * The scheduler is a machine calling in from outside with no cookies, so
     * middleware bounced it to /login exactly as it would a stranger, and the
     * nightly billing run would have quietly never happened. It is not open:
     * the route itself demands Vercel's own signature or the secret, and
     * answers 404 to anything else.
     *
     * - /auth/                  where a reset link and a Google sign-in land
     *
     * That last one is the whole front door, and it was not here.
     *
     * Both routes establish the session by exchanging what is in the URL — a
     * token hash from an email, a code from Google. So on the way in there is
     * no session yet, which is precisely what this middleware bounces to
     * /login. The link 307'd to /login carrying its token as a query string
     * that the login page ignores, and the handler that would have consumed it
     * never ran.
     *
     * The effect: nobody could reset a password and nobody could sign in with
     * Google, ever. It was invisible because anybody who already knew their
     * password signed in fine — /login is a client-side call and never
     * redirects. Marcie, whose account was created by hand in SQL and who
     * therefore had no password to know, had no way in at all.
     *
     * The last two have to be here or the whole feature is inert: a script tag
     * on a public page cannot carry a session, so auth would 307 both the
     * script and every event it tries to send to /login.
     */
    '/((?!_next/static|_next/image|favicon\\.ico|favicon\\.svg|images/|videos/|api/leads/ingest|api/estimates/decide|api/estimates/note|api/mail/inbound|api/public/|api/calendar/|api/stripe/webhook|q/|p/|e/|i/|s/|r/|new/|api/enquiry|t\\.js|api/track|api/preview/|api/card/|api/version|api/cron/|reset|auth/|c/).*)',
  ],
};
