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

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

const INK = '#111113';
const PANEL = '#ffffff';
const BORDER = '#e4e4e0';
const TEXT = '#1a1a1a';
const DIM = '#5a5a5a';
const FAINT = '#8a8a88';
const ACCENT = '#2563eb';
const RED = '#b91c1c';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'password' | 'reset'>('password');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(
    params.get('error') === 'auth' ? 'That sign-in link did not work. Try again.' : ''
  );

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

    router.push('/');
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
    fontSize: 14,
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
            Nautilus
          </div>
          <div style={{ fontSize: 13, color: FAINT, marginTop: 6 }}>
            Your workspace from CALO&amp;CO
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
              <div style={{ fontSize: 15, fontWeight: 500, color: TEXT, marginBottom: 8 }}>
                Check your email
              </div>
              <p style={{ fontSize: 13, color: DIM, lineHeight: 1.6, margin: 0 }}>
                If there&apos;s an account for <strong>{email}</strong>, a link to set a new
                password is on its way. It expires in an hour.
              </p>
              <button
                onClick={() => {
                  setSent(false);
                  setMode('password');
                }}
                style={{
                  marginTop: 18,
                  background: 'transparent',
                  border: 'none',
                  color: ACCENT,
                  fontSize: 13,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={mode === 'password' ? signIn : sendReset}>
              <div style={{ fontSize: 15, fontWeight: 500, color: TEXT, marginBottom: 4 }}>
                {mode === 'password' ? 'Sign in' : 'Reset your password'}
              </div>
              <p style={{ fontSize: 12.5, color: FAINT, margin: '0 0 20px', lineHeight: 1.5 }}>
                {mode === 'password'
                  ? 'Use the email your workspace was set up with.'
                  : "We'll email you a link to set a new one."}
              </p>

              <label style={{ display: 'block', marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: DIM, marginBottom: 6 }}>Email</div>
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
                  <div style={{ fontSize: 12, color: DIM, marginBottom: 6 }}>Password</div>
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
                    fontSize: 12.5,
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
                  borderRadius: 7,
                  padding: '12px',
                  fontSize: 14,
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
                  fontSize: 12.5,
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
            fontSize: 12.5,
            color: FAINT,
            lineHeight: 1.6,
          }}
        >
          Don&apos;t have an account yet?
          <br />
          Workspaces are set up for you —{' '}
          <a href="mailto:mikexcalo@gmail.com" style={{ color: ACCENT, textDecoration: 'none' }}>
            get in touch
          </a>
          .
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
