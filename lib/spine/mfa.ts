/**
 * Two-factor authentication.
 *
 * Supabase does the cryptography — generating the shared secret, rendering
 * the QR code, checking the six digits, and raising the session to aal2.
 * These are wrappers that give the operations names matching what a person
 * thinks they are doing, and that translate Supabase's error strings into
 * something worth reading at the moment you have mistyped a code.
 *
 * The enforcement is not here. It is in current_org_id() in the database,
 * because a check in the app only guards the app.
 */

import supabase from '@/lib/supabase';

export interface EnrolStart {
  factorId: string;
  /** An SVG data URI. Point the authenticator app at it. */
  qr: string;
  /** The same secret as text, for someone typing it in by hand. */
  secret: string;
}

/**
 * Begin enrolment. Produces an unverified factor — until a code from it is
 * accepted, nothing about the account has changed.
 */
export async function startEnrolment(): Promise<EnrolStart> {
  // A leftover unverified factor from an abandoned attempt blocks a fresh
  // one with "factor already exists", which reads as a bug to the person
  // simply trying again. Clear the debris first.
  const existing = await supabase.auth.mfa.listFactors();
  const stale = (existing.data?.all ?? []).filter((f) => f.status === 'unverified');
  for (const f of stale) await supabase.auth.mfa.unenroll({ factorId: f.id });

  /**
   * `issuer` is the name the authenticator app lists the account under.
   * Without it Supabase falls back to the project hostname, so people would
   * see "nautilusapp.vercel.app" sitting in their app next to their bank.
   *
   * Worth knowing before the product is renamed: this string is baked into
   * the QR code at the moment of setup. Changing it later renames nothing —
   * existing users keep seeing the old name until they re-enrol. So it is
   * pinned here rather than derived from anything, and the rename plan has
   * to include telling people why the label is stale.
   */
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    issuer: 'Nautilus',
    friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}`,
  });
  if (error) throw new Error(error.message);

  return {
    factorId: data.id,
    qr: data.totp.qr_code,
    secret: data.totp.secret,
  };
}

/** Confirm enrolment with the first code the app produces. */
export async function confirmEnrolment(factorId: string, code: string): Promise<void> {
  const challenge = await supabase.auth.mfa.challenge({ factorId });
  if (challenge.error) throw new Error(challenge.error.message);

  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.data.id,
    code: code.replace(/\s/g, ''),
  });
  if (error) throw new Error(friendly(error.message));
}

/** Answer the challenge at sign-in. */
export async function verifySignIn(code: string): Promise<void> {
  const factors = await supabase.auth.mfa.listFactors();
  if (factors.error) throw new Error(factors.error.message);

  const totp = (factors.data?.totp ?? []).find((f) => f.status === 'verified');
  if (!totp) throw new Error('No authenticator is set up on this account.');

  const challenge = await supabase.auth.mfa.challenge({ factorId: totp.id });
  if (challenge.error) throw new Error(challenge.error.message);

  const { error } = await supabase.auth.mfa.verify({
    factorId: totp.id,
    challengeId: challenge.data.id,
    code: code.replace(/\s/g, ''),
  });
  if (error) throw new Error(friendly(error.message));
}

/** Turn it off. Requires a session that already passed the second step. */
export async function disable(): Promise<void> {
  const factors = await supabase.auth.mfa.listFactors();
  if (factors.error) throw new Error(factors.error.message);

  for (const f of factors.data?.all ?? []) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id });
    if (error) throw new Error(error.message);
  }
  await fetch('/api/auth/mfa/codes', { method: 'DELETE' });
}

export async function isEnabled(): Promise<boolean> {
  const { data } = await supabase.rpc('mfa_enabled');
  return data === true;
}

export async function isPending(): Promise<boolean> {
  const { data } = await supabase.rpc('mfa_pending');
  return data === true;
}

export async function recoveryCodesRemaining(): Promise<number> {
  const { data } = await supabase.rpc('mfa_recovery_remaining');
  return typeof data === 'number' ? data : 0;
}

/**
 * Supabase's wording assumes you know what a factor is. At the moment
 * someone has fat-fingered six digits, they need to be told that and
 * nothing else.
 */
function friendly(message: string): string {
  if (/invalid.*(code|totp)|verification failed/i.test(message)) {
    return 'That code was not right. Codes change every 30 seconds — check your app and try the current one.';
  }
  if (/expired/i.test(message)) {
    return 'That code expired before it arrived. Try the one showing now.';
  }
  if (/rate|too many/i.test(message)) {
    return 'Too many tries. Wait a minute before trying again.';
  }
  return message;
}
