'use client';

/**
 * Sign in.
 *
 * This is where a client lands from the "Log in" link on calo.company, so it
 * has to make sense to someone who has never seen Nautilus and was told
 * "your portal is here" — not just to Mike.
 *
 * There is deliberately no self-signup. Accounts are created for a client
 * when their workspace is set up; an open signup form would let anyone make
 * an orphan account with no business attached, which looks broken and is
 * worse than an honest "ask us".
 */

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { verifySignIn } from '@/lib/spine/mfa';
import { PRODUCT, PROVIDER, SUPPORT_EMAIL } from '@/lib/brand';

const INK = '#111113';
const PANEL = '#ffffff';
const BORDER = '#e4e4e0';
const TEXT = '#1a1a1a';
const DIM = '#5a5a5a';
const FAINT = '#8a8a88';
const ACCENT = '#141414';
const RED = '#b91c1c';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'password' | 'reset' | 'code'>('password');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [error, setError] = useState(
    params.get('error') === 'auth'
      ? 'That sign-in link did not work. Try again.'
      : params.get('error') === 'expired'
      ? 'That link has already been used or has expired. Ask for a new one below.'
      : params.get('error') === 'noworkspace'
      ? `That account works, but no workspace is attached to it yet. ${PROVIDER} sets those up. Get in touch and we'll add you.`
      : ''
  );

  /**
   * Only offer Google if Supabase will actually accept it.
   *
   * Shipped without this check, the button was visible before the provider
   * was configured — and pressing it handed the browser to Supabase, which
   * answered with raw JSON on a blank white page. A dead end that looks like
   * the product crashed.
   *
   * /auth/v1/settings is public and lists which providers are live, so the
   * button can simply not exist until it works.
   */
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;

    fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
      .then((r) => r.json())
      .then((d) => setGoogleReady(!!d?.external?.google))
      .catch(() => setGoogleReady(false));
  }, []);

  /**
   * Google sign-in. Mark's email is on Google Workspace, so for him this is
   * one tap and no password to lose — and no invite email that has to survive
   * a spam filter to be useful.
   */
  const signInWithGoogle = async () => {
    setError('');
    setLoading(true);
    const supabase = createSupabaseBrowser();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (oauthError) {
      setError(oauthError.message);
      setLoading(false);
    }
    // On success the browser leaves for Google, so nothing to do here.
  };

  /**
   * Arriving with ?mfa=1 means middleware turned someone away for owing a
   * code — they are already past the password, so asking for it again would
   * be theatre. Go straight to the code step.
   */
  useEffect(() => {
    if (params.get('mfa') === '1') setMode('code');
  }, [params]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createSupabaseBrowser();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      // Supabase says "Invalid login credentials" for both a wrong password
      // and an account that doesn't exist. Say something a human can act on.
      setError(
        /invalid login/i.test(authError.message)
          ? "That email and password don't match. Check both, or reset your password below."
          : authError.message
      );
      setLoading(false);
      return;
    }

    /**
     * The password is only half the door when two-factor is on. Supabase
     * hands back a real session either way — it is just a session at the
     * lower assurance level, which the database treats as blind: every
     * policy comes back empty until the code is accepted. So there is no
     * harm in holding it while we ask.
     */
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === 'aal2' && aal.nextLevel !== aal.currentLevel) {
      setMode('code');
      setLoading(false);
      return;
    }

    router.push('/');
    router.refresh();
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await verifySignIn(code);
      router.push('/');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  };

  /**
   * Spending a recovery code takes the second factor off rather than
   * standing in for it — so this lands you signed in with a password-only
   * account, and the security page nags you to set it up again.
   */
  const submitRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createSupabaseBrowser();
    const { data: session } = await supabase.auth.getSession();

    const res = await fetch('/api/auth/mfa/codes', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ code: recovery }),
    });
    const payload = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(payload.error || 'That code did not work.');
      setLoading(false);
      return;
    }

    // The old token still says this session owes a factor that no longer
    // exists. Refresh it so the claim catches up before anything is loaded.
    await supabase.auth.refreshSession();
    router.push('/security');
    router.refresh();
  };

  const sendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createSupabaseBrowser();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });

    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    // Always report success — confirming which emails exist would leak them.
    setSent(true);
  };

  const field: React.CSSProperties = {
    width: '100%',
    background: '#fbfbfa',
    border: `1px solid ${BORDER}`,
    borderRadius: 7,
    padding: '11px 13px',
    fontSize: 15,
    color: TEXT,
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f7f7f5',
        padding: 20,
        fontFamily: 'inherit',
      }}
    >
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          <div style={{ fontSize: 22, fontWeight: 600, color: INK, letterSpacing: '-0.4px' }}>
            {PRODUCT}
          </div>
          <div style={{ fontSize: 14, color: FAINT, marginTop: 6 }}>
            Your workspace from {PROVIDER}
          </div>
        </div>

        <div
          style={{
            background: PANEL,
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            padding: 26,
          }}
        >
          {sent ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 500, color: TEXT, marginBottom: 8 }}>
                Check your email
              </div>
              <p style={{ fontSize: 14, color: DIM, lineHeight: 1.6, margin: '0 0 12px' }}>
                If there&apos;s an account for <strong>{email}</strong>, a link to set a new
                password is on its way. It usually lands within a minute and expires in an hour.
              </p>
              {/*
                Naming the spam folder is worth the line. Password resets are
                the most commonly filtered mail there is, and somebody who
                does not find it in thirty seconds concludes the product is
                broken rather than that Gmail moved it.

                It also quietly asks them to mark it as not spam, which is the
                single most useful thing anyone can do for a new sending
                domain's reputation.
              */}
              <p
                style={{
                  fontSize: 13.5,
                  color: DIM,
                  lineHeight: 1.6,
                  margin: 0,
                  background: '#f6f7f9',
                  border: `1px solid ${BORDER}`,
                  borderRadius: 8,
                  padding: '11px 13px',
                  textAlign: 'left',
                }}
              >
                Not there? Look in spam or junk, and mark it as not spam so the next one arrives
                properly. It comes from <strong>hello@calo.company</strong>.
              </p>
              <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 18 }}>
                <button
                  onClick={() => {
                    setSent(false);
                    setMode('reset');
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: ACCENT,
                    fontSize: 14,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Send it again
                </button>
                <button
                  onClick={() => {
                    setSent(false);
                    setMode('password');
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: DIM,
                    fontSize: 14,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Back to sign in
                </button>
              </div>
            </div>
          ) : mode === 'code' ? (
            <form onSubmit={useRecovery ? submitRecovery : submitCode}>
              <div style={{ fontSize: 16, fontWeight: 500, color: TEXT, marginBottom: 4 }}>
                {useRecovery ? 'Use a backup code' : 'One more step'}
              </div>
              <p style={{ fontSize: 13.5, color: FAINT, margin: '0 0 20px', lineHeight: 1.55 }}>
                {useRecovery
                  ? 'Enter one of the eight backup codes you saved during setup. It turns two-factor off so your password works on its own. Set it up again once you have your new phone.'
                  : `Open your authenticator app and enter the six-digit code it shows for ${PRODUCT}.`}
              </p>

              {useRecovery ? (
                <label style={{ display: 'block', marginBottom: 14 }}>
                  <div style={{ fontSize: 13, color: DIM, marginBottom: 6 }}>Backup code</div>
                  <input
                    value={recovery}
                    onChange={(e) => setRecovery(e.target.value.toUpperCase())}
                    required
                    autoFocus
                    placeholder="XXXXX-XXXXX"
                    style={{
                      ...field,
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                      letterSpacing: '.08em',
                    }}
                  />
                </label>
              ) : (
                <label style={{ display: 'block', marginBottom: 14 }}>
                  <div style={{ fontSize: 13, color: DIM, marginBottom: 6 }}>Six-digit code</div>
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    autoFocus
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    style={{
                      ...field,
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                      fontSize: 20,
                      letterSpacing: '.35em',
                      textAlign: 'center',
                    }}
                  />
                </label>
              )}

              {error && (
                <div
                  style={{
                    background: '#fbeded',
                    border: `1px solid ${RED}33`,
                    borderRadius: 7,
                    padding: '10px 12px',
                    fontSize: 13.5,
                    color: RED,
                    marginBottom: 14,
                    lineHeight: 1.5,
                  }}
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || (!useRecovery && code.length !== 6)}
                style={{
                  width: '100%',
                  background: INK,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 999,
                  padding: '12px',
                  fontSize: 15,
                  fontWeight: 500,
                  cursor: loading ? 'wait' : 'pointer',
                  opacity: loading || (!useRecovery && code.length !== 6) ? 0.5 : 1,
                  fontFamily: 'inherit',
                }}
              >
                {loading ? 'Checking…' : useRecovery ? 'Use this code' : 'Sign in'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setUseRecovery((v) => !v);
                  setError('');
                }}
                style={{
                  width: '100%',
                  marginTop: 14,
                  background: 'transparent',
                  border: 'none',
                  color: DIM,
                  fontSize: 13.5,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {useRecovery ? 'Back to the code from my phone' : 'Lost your phone? Use a backup code'}
              </button>
            </form>
          ) : (
            <form onSubmit={mode === 'password' ? signIn : sendReset}>
              <div style={{ fontSize: 16, fontWeight: 500, color: TEXT, marginBottom: 4 }}>
                {mode === 'password' ? 'Sign in' : 'Reset your password'}
              </div>
              <p style={{ fontSize: 13.5, color: FAINT, margin: '0 0 20px', lineHeight: 1.5 }}>
                {mode === 'password'
                  ? 'Use the email your workspace was set up with.'
                  : "We'll email you a link to set a new one."}
              </p>

              {mode === 'password' && googleReady && (
                <>
                  <button
                    type="button"
                    onClick={signInWithGoogle}
                    disabled={loading}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 10,
                      background: '#fff',
                      color: '#3c4043',
                      border: `1px solid ${BORDER}`,
                      borderRadius: 999,
                      padding: '11px',
                      fontSize: 15,
                      fontWeight: 500,
                      cursor: loading ? 'wait' : 'pointer',
                      fontFamily: 'inherit',
                      marginBottom: 18,
                    }}
                  >
                    {/* Google's mark, which they require be used unmodified
                        and in full color on a white button. */}
                    <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden>
                      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
                      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
                      <path fill="#FBBC05" d="M3.97 10.71a5.4 5.4 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.08l3.01-2.33z" />
                      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.17 6.66 3.58 9 3.58z" />
                    </svg>
                    Continue with Google
                  </button>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      marginBottom: 18,
                    }}
                  >
                    <div style={{ flex: 1, height: 1, background: BORDER }} />
                    <span style={{ fontSize: 12.5, color: FAINT }}>or use your email</span>
                    <div style={{ flex: 1, height: 1, background: BORDER }} />
                  </div>
                </>
              )}

              <label style={{ display: 'block', marginBottom: 14 }}>
                <div style={{ fontSize: 13, color: DIM, marginBottom: 6 }}>Email</div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  autoComplete="email"
                  style={field}
                  placeholder="you@company.com"
                />
              </label>

              {mode === 'password' && (
                <label style={{ display: 'block', marginBottom: 14 }}>
                  <div style={{ fontSize: 13, color: DIM, marginBottom: 6 }}>Password</div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    style={field}
                  />
                </label>
              )}

              {error && (
                <div
                  style={{
                    background: '#fbeded',
                    border: `1px solid ${RED}33`,
                    borderRadius: 7,
                    padding: '10px 12px',
                    fontSize: 13.5,
                    color: RED,
                    marginBottom: 14,
                    lineHeight: 1.5,
                  }}
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  background: INK,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 999,
                  padding: '12px',
                  fontSize: 15,
                  fontWeight: 500,
                  cursor: loading ? 'wait' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                  fontFamily: 'inherit',
                }}
              >
                {loading
                  ? 'One moment…'
                  : mode === 'password'
                  ? 'Sign in'
                  : 'Send reset link'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'password' ? 'reset' : 'password');
                  setError('');
                }}
                style={{
                  width: '100%',
                  marginTop: 14,
                  background: 'transparent',
                  border: 'none',
                  color: DIM,
                  fontSize: 13.5,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {mode === 'password' ? 'Forgot your password?' : 'Back to sign in'}
              </button>
            </form>
          )}
        </div>

        <div
          style={{
            textAlign: 'center',
            marginTop: 20,
            fontSize: 13.5,
            color: FAINT,
            lineHeight: 1.6,
          }}
        >
          Don&apos;t have an account yet?
          <br />
          Workspaces are set up for you.{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: ACCENT, textDecoration: 'none' }}>
            get in touch
          </a>
          .
          <div style={{ marginTop: 14 }}>
            <a href="/trust" style={{ color: FAINT, textDecoration: 'underline' }}>
              How we look after your data
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  // useSearchParams needs a Suspense boundary during static generation.
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
