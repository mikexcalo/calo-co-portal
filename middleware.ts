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
  const isPublic = path.startsWith('/login') || path.startsWith('/welcome');

  // Not logged in → redirect to /login (unless already there)
  if (!user && !path.startsWith('/login')) {
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
  const profile = user
    ? (await supabase.from('profiles').select('id, mfa_enabled').eq('id', user.id).maybeSingle())
        .data
    : null;

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

  return supabaseResponse;
}

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
     * - /e/                     the customer-facing estimate page
     * - /i/                     the customer-facing invoice page
     */
    '/((?!_next/static|_next/image|favicon\\.ico|favicon\\.svg|images/|videos/|api/leads/ingest|api/estimates/decide|api/public/|api/calendar/|api/stripe/webhook|e/|i/).*)',
  ],
};
