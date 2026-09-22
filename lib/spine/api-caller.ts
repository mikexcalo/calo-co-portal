/**
 * Who is calling, and is this theirs.
 *
 * A handful of API routes do work the caller could not do directly — mint a
 * capability token, flip an invoice to sent, email a customer — so they run on
 * the service-role key, which bypasses row-level security completely.
 *
 * The only thing in front of them was the middleware redirect. That
 * establishes that SOMEBODY is signed in and nothing whatsoever about who: any
 * authenticated user who could guess an id could send another business's
 * invoice to another business's customer. Every wall this product has is in
 * the database, and these routes were the handful of places that walk straight
 * past it.
 *
 * Written once, here, because five routes needed the identical check and five
 * copies is how one of them ends up subtly different a month from now.
 */

import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export interface Caller {
  userId: string;
}

/** The signed-in user, or null when there isn't one. */
export async function whoIsCalling(): Promise<Caller | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;

  const store = cookies();
  const supabase = createServerClient(url, anon, {
    cookies: { get: (n: string) => store.get(n)?.value, set: () => {}, remove: () => {} },
  });
  const { data } = await supabase.auth.getUser();
  return data?.user ? { userId: data.user.id } : null;
}

/**
 * Does this person belong to the business that owns this row.
 *
 * Takes the service-role client because the whole point is to answer a
 * question the caller's own session cannot see across.
 */
export async function belongsToCaller(
  db: SupabaseClient,
  userId: string,
  table: string,
  id: string
): Promise<boolean> {
  const { data: row } = await db.from(table).select('org_id').eq('id', id).maybeSingle();
  if (!row?.org_id) return false;
  const { data: member } = await db
    .from('memberships')
    .select('id')
    .eq('user_id', userId)
    .eq('org_id', row.org_id)
    .maybeSingle();
  return !!member;
}

/** The service-role client these routes run their actual work on. */
export function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}
