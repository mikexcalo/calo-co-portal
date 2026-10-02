/**
 * The password door's half of "land in your own business".
 *
 * WHY A ROUTE AND NOT A LINE IN THE FORM
 *
 * The other two doors - the code exchange and the email link - are server
 * handlers holding the service role, and they call `landInYourOwn` directly.
 * A password sign-in happens in the browser, and the browser cannot answer
 * the question: `memberships` is readable only inside the workspace you are
 * currently standing in, which is the client's, which is the thing being
 * corrected. So the browser says "I just signed in" and the server works out
 * where that should land.
 *
 * It takes nothing and trusts nothing. The caller is read from the session
 * cookie, never from the body, so this cannot be pointed at anybody else.
 */

import { NextResponse } from 'next/server';
import { whoIsCalling, serviceClient } from '@/lib/spine/api-caller';
import { landInYourOwn } from '@/lib/spine/home-workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const caller = await whoIsCalling();
  if (!caller?.userId) return NextResponse.json({ landed: null });

  const db = serviceClient();
  if (!db) return NextResponse.json({ landed: null });

  return NextResponse.json({ landed: await landInYourOwn(db, caller.userId) });
}
