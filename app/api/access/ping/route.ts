/**
 * Someone is in the building.
 *
 * Records a page view against the signed-in user, and emails Mike the first
 * time each person shows up on a given day. First time only — a notification
 * that fires on every page view is a notification you mute within a week, and
 * a muted alert is worse than none because you believe you still have one.
 *
 * The browser sends a path and nothing else. Who it is comes from the session
 * cookie, verified server side, which is the whole reason this is a route and
 * not a direct insert from the client.
 *
 * Failures are swallowed on purpose. Nobody's workspace should break because
 * an analytics write or an email did not go through.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { postEmail } from '@/lib/spine/deliverable';

export const runtime = 'nodejs';

/** Nothing to say back. The page is not waiting on this. */
const quiet = () => new NextResponse(null, { status: 204 });

/**
 * People whose arrivals are not news.
 *
 * Mike is in here every day; telling him he signed in teaches him to ignore
 * the sender. ACCESS_ALERT_IGNORE is a comma-separated list; ALERT_EMAIL is
 * assumed to be his own and skipped without needing to be listed twice.
 */
function ignored(email: string | null): boolean {
  if (!email) return true;
  const list = [
    process.env.ALERT_EMAIL ?? '',
    ...(process.env.ACCESS_ALERT_IGNORE ?? '').split(','),
  ]
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return quiet();

  let path = '/';
  try {
    const body = (await req.json()) as { path?: string };
    if (typeof body?.path === 'string' && body.path.startsWith('/')) path = body.path;
  } catch {
    /* a ping with no body still counts as an arrival */
  }

  const store = cookies();
  const supabase = createServerClient(url, anon, {
    cookies: { get: (n: string) => store.get(n)?.value, set: () => {}, remove: () => {} },
  });

  const { data, error } = await supabase.rpc('record_access', { p_path: path });
  if (error || !data || data.recorded !== true) return quiet();
  if (data.first_today !== true) return quiet();
  if (ignored(data.email)) return quiet();

  const resendKey = process.env.RESEND_API_KEY;
  const to = process.env.ALERT_EMAIL || 'mikexcalo@gmail.com';
  if (!resendKey) return quiet();

  const when = new Date().toLocaleString('en-US', {
    timeZone: 'America/New_York',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const org = typeof data.org === 'string' && data.org ? data.org : 'no business selected';

  try {
    await postEmail(to, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || 'CALO&CO <onboarding@resend.dev>',
        to,
        subject: `${data.email} just signed in`,
        text:
          `${data.email} signed in at ${when} Eastern.\n\n` +
          `Business: ${org}\n` +
          `Landed on: ${path}\n\n` +
          `That's the only email you'll get about them today. To see what they ` +
          `did, run this in the Supabase SQL editor:\n\n` +
          `  select * from access_by_day;\n\n` +
          `  select at, email, path from access_events\n` +
          `   where email = '${data.email}'\n` +
          `   order by at desc limit 50;\n`,
      }),
    });
  } catch {
    /* the visit is recorded either way, which is the part that matters */
  }

  return quiet();
}
