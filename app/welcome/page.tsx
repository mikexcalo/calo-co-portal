'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

export default function WelcomePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setSaving(true);
    setError('');

    const supabase = createSupabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setError('Not authenticated.');
      setSaving(false);
      return;
    }

    const { error: dbError } = await supabase.from('profiles').insert({
      id: user.id,
      full_name: trimmed,
    });

    if (dbError) {
      // Profile may already exist (race condition) — try update
      if (dbError.code === '23505') {
        await supabase.from('profiles').update({ full_name: trimmed }).eq('id', user.id);
      } else {
        setError(dbError.message);
        setSaving(false);
        return;
      }
    }

    // Also update user_metadata so the greeting picks it up immediately
    await supabase.auth.updateUser({ data: { full_name: trimmed } });

    router.push('/');
    router.refresh();
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.heading}>Welcome to Nautilus</h1>
        <p style={styles.sub}>What should we call you?</p>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your first name"
            required
            autoFocus
            style={styles.input}
          />
          <button type="submit" disabled={saving || !name.trim()} style={styles.btn}>
            {saving ? 'Saving…' : 'Continue'}
          </button>
        </form>
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
    maxWidth: '400px',
    textAlign: 'center',
  },
  heading: {
    fontFamily: 'Georgia, serif',
    fontSize: '32px',
    fontWeight: 400,
    color: '#f5f5f5',
    letterSpacing: '-0.02em',
    margin: '0 0 10px',
  },
  sub: {
    fontSize: '15px',
    color: '#6a6a6e',
    margin: '0 0 36px',
  },
  error: {
    background: 'rgba(248,113,113,0.12)',
    border: '1px solid rgba(248,113,113,0.25)',
    borderRadius: '8px',
    padding: '12px 16px',
    fontSize: '14px',
    color: '#f87171',
    marginBottom: '20px',
    textAlign: 'left' as const,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  input: {
    padding: '14px 16px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.10)',
    background: '#1c1c20',
    color: '#f5f5f5',
    fontSize: '16px',
    textAlign: 'center',
    outline: 'none',
  },
  btn: {
    padding: '14px',
    borderRadius: '8px',
    border: 'none',
    background: '#f5f5f5',
    color: '#111113',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
  },
};
