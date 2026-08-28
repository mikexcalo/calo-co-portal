/**
 * Recovery codes — issuing them, and spending one to get back in.
 *
 * The reason this exists: the single thing that stops people turning on
 * two-factor is the fear of losing the phone, and that fear is justified.
 * Supabase provides no way back in. Without recovery codes the answer to a
 * dead phone is "email Mike and hope he is awake", which is not an answer for
 * software someone runs their business on.
 *
 * WHAT A RECOVERY CODE DOES: it removes the second factor. It does not log
 * anyone in. Whoever spends one still faces the password, so a stolen code on
 * its own gets nobody anywhere — it puts the account back to where it was
 * before two-factor was switched on, no further.
 *
 * Codes are stored as SHA-256 hashes and never read back. Not even the owner
 * can list them; the app is told a count and nothing more. A ten-character
 * code is short enough that a hash plus a GPU would recover it, so the hash
 * has to stay behind the service role.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash, randomInt } from 'crypto';

export const runtime = 'nodejs';

/**
 * No 0/O/1/I/L. These get read off a screen and typed months later, often
 * from a printout, and that is exactly when a zero becomes an O.
 */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const CODE_COUNT = 8;

function makeCode(): string {
  // randomInt, not Math.random. This is a credential.
  const pick = () => ALPHABET[randomInt(0, ALPHABET.length)];
  const block = (n: number) => Array.from({ length: n }, pick).join('');
  return `${block(5)}-${block(5)}`;
}

const hash = (code: string) =>
  createHash('sha256').update(code.replace(/[\s-]/g, '').toUpperCase()).digest('hex');

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Who is calling, according to their token rather than their claim. */
async function callerId(req: NextRequest): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!url || !anon || !token) return null;

  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await client.auth.getUser(token);
  return error ? null : data.user?.id ?? null;
}

/**
 * Issue a fresh set. Any unused codes from a previous set are destroyed —
 * a set someone printed and lost should stop working the moment they decide
 * to print another.
 */
export async function POST(req: NextRequest) {
  const db = admin();
  if (!db) return NextResponse.json({ error: 'Server is not configured' }, { status: 500 });

  const userId = await callerId(req);
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const codes = Array.from({ length: CODE_COUNT }, makeCode);

  await db.from('mfa_recovery_codes').delete().eq('user_id', userId).is('used_at', null);
  const { error } = await db
    .from('mfa_recovery_codes')
    .insert(codes.map((c) => ({ user_id: userId, code_hash: hash(c) })));

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // The only time these are ever readable. There is no second chance to see
  // them, which the screen showing them says plainly.
  return NextResponse.json({ codes });
}

/**
 * Spend one.
 *
 * Reached from the sign-in screen by someone who got past the password and
 * then could not produce a code. Their session is real but only half-built,
 * which is enough to prove who they are and not enough to see any data —
 * current_org_id() returns null until the second step is done.
 */
export async function PUT(req: NextRequest) {
  const db = admin();
  if (!db) return NextResponse.json({ error: 'Server is not configured' }, { status: 500 });

  const userId = await callerId(req);
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  if (!code || code.replace(/[\s-]/g, '').length < 8) {
    return NextResponse.json({ error: 'That does not look like a recovery code.' }, { status: 400 });
  }

  const match = await db
    .from('mfa_recovery_codes')
    .select('id')
    .eq('user_id', userId)
    .eq('code_hash', hash(code))
    .is('used_at', null)
    .maybeSingle();

  if (match.error) return NextResponse.json({ error: match.error.message }, { status: 500 });
  if (!match.data) {
    return NextResponse.json(
      { error: 'That code is not valid, or it has already been used.' },
      { status: 400 }
    );
  }

  // Burn it before acting on it. If the unenroll below fails, the worst case
  // is a spent code and a still-locked account — recoverable. Burning it
  // afterwards leaves a window where the same code works twice.
  const burn = await db
    .from('mfa_recovery_codes')
    .update({ used_at: new Date().toISOString() })
    .eq('id', match.data.id)
    .is('used_at', null)
    .select('id')
    .maybeSingle();

  if (burn.error || !burn.data) {
    return NextResponse.json({ error: 'That code has already been used.' }, { status: 400 });
  }

  const { data: factors, error: listErr } = await db.auth.admin.mfa.listFactors({ userId });
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });

  for (const f of factors?.factors ?? []) {
    await db.auth.admin.mfa.deleteFactor({ id: f.id, userId });
  }

  // Every remaining code goes too. The phone is gone; the codes that were
  // sitting next to it should be assumed gone with it.
  await db.from('mfa_recovery_codes').delete().eq('user_id', userId).is('used_at', null);

  return NextResponse.json({ ok: true });
}

/** Clear unused codes — called when two-factor is switched off. */
export async function DELETE(req: NextRequest) {
  const db = admin();
  if (!db) return NextResponse.json({ error: 'Server is not configured' }, { status: 500 });

  const userId = await callerId(req);
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  await db.from('mfa_recovery_codes').delete().eq('user_id', userId);
  return NextResponse.json({ ok: true });
}
