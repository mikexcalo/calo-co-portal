'use client';

/**
 * Where "set a new password" has to land.
 *
 * Forgot-password sent people through /auth/callback, which signs them in and
 * drops them on Home. Nothing in that path ever asked for a password — so
 * somebody followed a link that said "set a new password", arrived somewhere
 * else entirely, and still could not sign in the next day.
 *
 * The session from the link is already live by the time this renders, which
 * is the only reason updateUser works here without anybody typing an old
 * password they do not have.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { human } from '@/lib/spine/errors';
import { PRODUCT } from '@/lib/brand';

export default function ResetPage() {
  const router = useRouter();
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState<boolean | null>(null);

  /* The link carries the session. No session means the link has been used or
     has expired, and saying so beats a password box that cannot work. */
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setReady(Boolean(data?.user)));
  }, []);

  async function save() {
    if (pw.length < 8) { setError('Eight characters or more.'); return; }
    setBusy(true); setError('');
    const res = await supabase.auth.updateUser({ password: pw });
    if (res.error) { setError(human(res.error)); setBusy(false); return; }
    router.push('/');
  }

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '48px 24px', background: '#FFFFFF', color: '#1D1F24' }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em', margin: '0 0 8px' }}>
          Pick a new password
        </h1>

        {ready === false ? (
          <>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: '#383D45', margin: '0 0 20px' }}>
              That link has already been used, or it has expired. They work once and last
              about a day.
            </p>
            <button
              onClick={() => router.push('/login')}
              style={{ background: '#141414', color: '#fff', border: 'none', borderRadius: 999, padding: '11px 22px', fontSize: 14.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Ask for another
            </button>
          </>
        ) : (
          <>
            {/*
              The rule, on screen, before it is broken.

              It lived in the placeholder — which vanishes the moment anybody
              types — and in an error that only appeared after a failed
              attempt. Meanwhile the button sat greyed out saying nothing about
              why. So somebody picked a six-character password, found a dead
              button and no explanation, and the only place the requirement was
              actually written down was a note Mike had to send by hand to
              every single person he onboards.
            */}
            <p style={{ fontSize: 15, lineHeight: 1.6, color: '#383D45', margin: '0 0 6px' }}>
              This is the one you will use from now on. Nobody else has it, including us.
            </p>
            <p style={{ fontSize: 13.5, lineHeight: 1.6, color: '#5B6069', margin: '0 0 18px' }}>
              Eight characters or more.
            </p>
            <input
              type="password"
              value={pw}
              onChange={(e) => { setPw(e.target.value); setError(''); }}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              autoFocus
              style={{
                width: '100%', padding: '11px 13px', fontSize: 15, fontFamily: 'inherit',
                border: '1px solid #E7E8EB', borderRadius: 9, color: '#1D1F24',
              }}
            />
            {error && <p style={{ fontSize: 13.5, color: '#E01B1B', margin: '10px 0 0' }}>{error}</p>}
            <button
              onClick={save}
              disabled={busy || pw.length < 8}
              style={{
                marginTop: 16, width: '100%', background: pw.length < 8 ? '#9198A1' : '#141414',
                color: '#fff', border: 'none', borderRadius: 999, padding: '12px 22px',
                fontSize: 15, fontWeight: 500, cursor: pw.length < 8 ? 'default' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {busy
                ? 'Saving…'
                : pw.length === 0
                  ? 'Save it and sign in'
                  : pw.length < 8
                    ? `${8 - pw.length} more character${8 - pw.length === 1 ? '' : 's'}`
                    : 'Save it and sign in'}
            </button>
          </>
        )}

        <p style={{ fontSize: 12.5, color: '#8A9099', marginTop: 26 }}>{PRODUCT}</p>
      </div>
    </main>
  );
}
