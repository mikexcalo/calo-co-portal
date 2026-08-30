/**
 * Where a sign-in link or a Google sign-in lands.
 *
 * The important work here is not the code exchange, it is what happens to
 * someone who signs in successfully and has no business attached.
 *
 * With email that could not happen — accounts were created by hand alongside
 * a membership. Google changes that: anyone with a Google account can present
 * a valid identity, and Supabase will happily make them a user. Without a
 * check they would land in a working-looking app containing nothing, which
 * reads as broken software rather than as "you weren't expected".
 *
 * So: signed in, no membership, signed straight back out with a sentence that
 * says what to do about it. There is deliberately no self-signup here, and
 * this is what keeps that true now that the front door has a second key.
 */

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (!code) return NextResponse.redirect(`${origin}/login?error=auth`);

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
            // Ignore
          }
        },
      },
    }
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(`${origin}/login?error=auth`);

  /**
   * Read memberships with the service role rather than the new session.
   * A brand-new user has no profile row, and current_org_id() depends on one,
   * so asking as them would return nothing and every first sign-in would look
   * like a rejection.
   */
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey) {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
      auth: { persistSession: false },
    });

    const { data: memberships } = await admin
      .from('memberships')
      .select('org_id')
      .eq('user_id', data.user.id)
      .limit(1);

    if (!memberships?.length) {
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/login?error=noworkspace`);
    }

    /**
     * First sign-in for an invited person needs the profile row the rest of
     * the app assumes exists.
     *
     * Created only when it is genuinely missing. An upsert here would rewrite
     * active_org_id on every sign-in, quietly moving anyone with more than one
     * business back to whichever came first — which is how a price list ended
     * up displayed under the wrong company's name once already.
     */
    const { data: existing } = await admin
      .from('profiles')
      .select('id')
      .eq('id', data.user.id)
      .maybeSingle();

    if (!existing) {
      await admin.from('profiles').insert({
        id: data.user.id,
        full_name:
          (data.user.user_metadata?.full_name as string) ??
          (data.user.user_metadata?.name as string) ??
          null,
        active_org_id: memberships[0].org_id,
      });
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
