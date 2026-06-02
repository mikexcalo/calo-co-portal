'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(searchParams.get('error') === 'auth' ? 'Authentication failed. Please try again.' : '');
  const [loading, setLoading] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createSupabaseBrowser();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push('/');
    router.refresh();
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);

    const supabase = createSupabaseBrowser();
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // TODO: Configure Google OAuth in the Supabase Dashboard:
        // 1. Go to Authentication → Providers → Google
        // 2. Enable Google provider
        // 3. Paste your Google Client ID and Client Secret
        // 4. Set the authorized redirect URI in Google Cloud Console to:
        //    https://<your-project>.supabase.co/auth/v1/callback
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.brand}>Nautilus</div>
        <p style={styles.sub}>Sign in to continue</p>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleEmailLogin} style={styles.form}>
          <label style={styles.label}>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={styles.input}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </label>
          <label style={styles.label}>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={styles.input}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </label>
          <button type="submit" disabled={loading} style={styles.btn}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div style={styles.divider}>
          <span style={styles.dividerLine} />
          <span style={styles.dividerText}>or</span>
          <span style={styles.dividerLine} />
        </div>

        <button onClick={handleGoogleLogin} disabled={loading} style={styles.googleBtn}>
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59A14.5 14.5 0 0 1 9.5 24c0-1.59.28-3.14.76-4.59l-7.98-6.19A23.99 23.99 0 0 0 0 24c0 3.77.9 7.34 2.56 10.52l7.97-5.93z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 5.93C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Continue with Google
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#111113',
    padding: '24px',
  },
  card: {
    width: '100%',
    maxWidth: '380px',
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
  },
  brand: {
    fontFamily: 'Georgia, serif',
    fontSize: '28px',
    fontWeight: 400,
    color: '#f5f5f5',
    letterSpacing: '-0.02em',
    marginBottom: '8px',
  },
  sub: {
    fontSize: '15px',
    color: '#6a6a6e',
    margin: '0 0 32px',
  },
  error: {
    background: 'rgba(248,113,113,0.12)',
    border: '1px solid rgba(248,113,113,0.25)',
    borderRadius: '8px',
    padding: '12px 16px',
    fontSize: '14px',
    color: '#f87171',
    marginBottom: '20px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    fontSize: '13px',
    fontWeight: 500,
    color: '#a1a1a5',
  },
  input: {
    padding: '12px 14px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.10)',
    background: '#1c1c20',
    color: '#f5f5f5',
    fontSize: '15px',
    outline: 'none',
    transition: 'border-color 0.15s',
  },
  btn: {
    marginTop: '8px',
    padding: '14px',
    borderRadius: '8px',
    border: 'none',
    background: '#f5f5f5',
    color: '#111113',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    margin: '28px 0',
  },
  dividerLine: {
    flex: 1,
    height: '1px',
    background: 'rgba(255,255,255,0.08)',
  },
  dividerText: {
    fontSize: '13px',
    color: '#6a6a6e',
  },
  googleBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: '13px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'transparent',
    color: '#f5f5f5',
    fontSize: '15px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background 0.15s, border-color 0.15s',
  },
};
