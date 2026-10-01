'use client';

/**
 * Who you are in the workspace you are standing in.
 *
 * Two screens asked this on every switch and both asked it the same expensive
 * way: `auth.getUser()`, then the profile, then the membership, in series.
 * Home wanted the first name for the greeting; the tutorial panel wanted to
 * know whether to offer setup. Three round trips each, six between them, and
 * the two memberships reads were the same question about the same person in
 * the same business.
 *
 * Two things were wrong with it beyond the count.
 *
 * `getUser()` is a network call to the auth server, and gotrue holds its lock
 * while it runs — so every other Supabase query in the browser waits behind
 * it. Measured in Chrome against the live site: two of these at the front of a
 * workspace switch, serialized by that lock, and the screen's own data did not
 * start loading until both had returned. About 270ms of the switch was spent
 * asking who was signed in, twice, when the answer was already in memory.
 *
 * `getSession()` reads the token the browser already holds. Nothing here is a
 * permission decision — row-level security decides what this person can read,
 * in the database, against the real token — so the weaker check is the correct
 * one. Same argument as `orgNow()` in db.ts, which learned it first.
 *
 * Not cached across mounts on purpose. Someone changing their name in settings
 * should see the greeting change when they next land on Home, and a cache here
 * would hold yesterday's name until the tab was reloaded. Callers that arrive
 * together share the one lookup, which is where the saving actually was.
 */

import supabase from '@/lib/supabase';

export interface MeHere {
  userId: string | null;
  /** First name only, for the top of Home. Empty when nobody has set one. */
  firstName: string;
  /** Owner or admin of THIS workspace, so setup is theirs to do. */
  canSetUp: boolean;
}

const NOBODY: MeHere = { userId: null, firstName: '', canSetUp: false };

/** One lookup shared by everything that asks while it is in flight. */
let asking: { org: string; p: Promise<MeHere> } | null = null;

export async function meHere(orgId: string | null | undefined): Promise<MeHere> {
  if (!orgId) return NOBODY;
  if (asking?.org === orgId) return asking.p;

  const p = (async (): Promise<MeHere> => {
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user?.id;
    if (!uid) return NOBODY;

    // Neither answer is the other's input, so neither waits for the other.
    const [prof, mem] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', uid).maybeSingle(),
      supabase
        .from('memberships')
        .select('role')
        .eq('user_id', uid)
        .eq('org_id', orgId)
        .maybeSingle(),
    ]);

    const whole = (prof.data?.full_name ?? '').trim();
    return {
      userId: uid,
      firstName: whole ? whole.split(/\s+/)[0] : '',
      canSetUp: ['owner', 'admin'].includes(mem.data?.role ?? ''),
    };
  })();

  asking = { org: orgId, p };
  try {
    return await p;
  } finally {
    if (asking?.p === p) asking = null;
  }
}

/**
 * Just the signed-in person's id.
 *
 * Several small panels want this at mount only so they can ask "which of
 * these rows are mine" — a question row-level security answers again in the
 * database whatever this returns. They each called `auth.getUser()`, which is
 * a network round trip to the auth server holding gotrue's lock, so four
 * panels mounting together put four serialized hops in front of every query
 * on the screen. The token is already in the browser.
 */
export async function myId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

/**
 * Id and email together, for the few callers that want both.
 *
 * Same bargain as `myId`: the token in the browser already carries them, and
 * nothing decided from them is a permission - the database decides that again
 * against the real token. The top bar wanted an email and was paying a network
 * round trip to the auth server for it, on every screen.
 */
export async function meNow(): Promise<{ id: string | null; email: string | null }> {
  const { data } = await supabase.auth.getSession();
  const u = data.session?.user;
  return { id: u?.id ?? null, email: u?.email ?? null };
}
