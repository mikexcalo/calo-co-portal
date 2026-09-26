'use client';

/**
 * Telling the server which mode you are in.
 *
 * readonly.ts holds the mode as a module variable, which is the right place
 * for the browser to read it fast and the wrong place for anything to depend
 * on: it is the customer's own code on the customer's own machine. The
 * database cannot see it, so until now the database could not tell "Mike
 * looking" from "Mike working" - both are the same Postgres role with an
 * owner membership in every client workspace.
 *
 * A row fixes that. Entering a mode opens one; leaving ends it; the triggers
 * in 20261028000010 read it on every write.
 *
 * Deliberately fire-and-forget on the way in, awaited on the way out.
 * Opening is a guard getting stricter and a slow network should not delay the
 * screen; CLOSING is a guard getting looser, and a session left open would
 * refuse the owner's writes in their own workspace afterwards. So the close
 * is the one that gets waited on and retried.
 */

import supabase from '@/lib/supabase';

let openId: string | null = null;

/**
 * Open a session for this workspace. Any previous one is closed first.
 *
 * Returns whether the server actually knows. A false here means the mode is
 * being enforced by the browser alone, which is the state this whole file
 * exists to end - so the caller drops back out of the mode rather than
 * standing in a View mode that only looks like one.
 */
export async function openSession(
  orgId: string,
  mode: 'view' | 'work',
  grantId?: string | null
): Promise<boolean> {
  await closeSession();
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user?.id;
  if (!uid) return false;

  const res = await supabase
    .from('work_sessions')
    .insert({ user_id: uid, org_id: orgId, mode, grant_id: grantId ?? null })
    .select('id')
    .maybeSingle();
  openId = (res.data as { id?: string } | null)?.id ?? null;
  return openId !== null;
}

/**
 * End it.
 *
 * Also ends anything else this person has left open, anywhere. A tab closed
 * mid-session, a crash, a phone going to sleep: each leaves a row that would
 * otherwise refuse their own writes forever. The sweep is cheap and it is the
 * difference between a guard and a trap.
 */
export async function closeSession(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user?.id;
  if (!uid) { openId = null; return; }

  await supabase
    .from('work_sessions')
    .update({ ended_at: new Date().toISOString() })
    .eq('user_id', uid)
    .is('ended_at', null);
  openId = null;
}

/** For tests and for the bar, so it can say what the server thinks. */
export const currentSessionId = (): string | null => openId;
