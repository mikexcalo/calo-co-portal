'use client';

/**
 * Where "set a new password" has to land.
 *
 * Forgot-password sent people through /auth/callback, which signs them in and
 * drops them on Home. Nothing in that path ever asked for a password - so
 * somebody followed a link that said "set a new password", arrived somewhere
 * else entirely, and still could not sign in the next day.
 *
 * The session from the link is already live by the time this renders, which
 * is the only reason updateUser works here without anybody typing an old
 * password they do not have. It is also how this page knows whose workspace
 * it is: the session names the person, and the person has exactly one
 * business open.
 *
 * WHY IT IS BARE
 *
 * It was not. `AppShell` treated every path except a short list as inside the
 * app, and this one was not on the list, so a stranger resetting a password
 * was shown the sidebar, Search, Add a note and Log time - and on a phone, a
 * workspace plate naming a business that was not theirs.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { human } from '@/lib/spine/errors';
import { Door, type DoorWorkspace, PROSE_WRAP, LINK_LASTS, noWidow } from '@/components/public/Door';
import { studioFor } from '@/lib/spine/workin';

const INK = '#141414';
const DIM = '#5a5a5a';
const FAINT = '#8a8a88';
const BORDER = '#e4e4e0';

const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

export default function ResetPage() {
  const router = useRouter();
  const [pw, setPw] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState<boolean | null>(null);
  const [who, setWho] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<DoorWorkspace | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    const user = data?.user ?? null;
    setReady(Boolean(user));
    if (!user) return;
    setWho(user.email ?? null);

    /* Whose business this is, so the door can say so. A failure here costs
       the name and nothing else, so it is not worth an error. */
    try {
      const p = await supabase.from('profiles').select('active_org_id').eq('id', user.id).maybeSingle();
      const orgId = (p.data as { active_org_id?: string } | null)?.active_org_id;
      if (!orgId) return;
      const [o, house] = await Promise.all([
        supabase.from('orgs').select('name').eq('id', orgId).maybeSingle(),
        /* The reset link signed them in, so the RPC the rest of the product
           uses to name a studio works here too. */
        studioFor(orgId),
      ]);
      const name = (o.data as { name?: string } | null)?.name;
      if (name) setWorkspace({ name, logo: null, initials: initialsOf(name), studio: house.studio?.name ?? null });
    } catch {
      /* The door falls back to ours, which is still a door. */
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function save() {
    if (pw.length < 8) { setError('Eight characters or more.'); return; }
    if (pw !== again) { setError('Those two do not match.'); return; }
    setBusy(true); setError('');
    const res = await supabase.auth.updateUser({ password: pw });
    if (res.error) { setError(human(res.error)); setBusy(false); return; }
    router.push('/');
  }

  const field: React.CSSProperties = {
    width: '100%', padding: '11px 13px', fontSize: 15, fontFamily: 'inherit',
    border: `1px solid ${BORDER}`, borderRadius: 9, color: '#1D1F24', boxSizing: 'border-box',
  };
  const label: React.CSSProperties = {
    display: 'block', fontSize: 12.5, fontWeight: 500, color: DIM, marginBottom: 6,
  };

  /* Nothing decided yet. Neither state is drawn, because a password box that
     cannot work and a "that link is finished" are both wrong answers while
     the session is still being read. */
  if (ready === null) {
    return (
      <Door workspace={null} heading="Choose a new password" subline="One moment.">
        <div style={{ height: 132 }} />
      </Door>
    );
  }

  /*
    No token, or a token already spent.

    It used to say "That link has already been used, or it has expired" to
    everybody, including somebody who simply opened the page - told they had
    done something wrong when they had done nothing at all. It asks rather
    than accuses now, and the two cases are genuinely indistinguishable from
    here: both arrive with no session.
  */
  if (!ready) {
    return (
      <Door
        workspace={null}
        heading="Request a new link"
        subline="Password links are single use, so this page needs a fresh one."
      >
        <p style={{ fontSize: 14, color: DIM, lineHeight: 1.7, margin: '0 0 18px', ...PROSE_WRAP }}>
          {noWidow(`Ask for one from the sign-in screen and it will be in your inbox in a moment. ${LINK_LASTS}`)}
        </p>
        <button
          onClick={() => router.push('/login')}
          style={{
            width: '100%', background: INK, color: '#fff', border: 'none', borderRadius: 999,
            padding: '12px', fontSize: 15, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Go to sign in
        </button>
      </Door>
    );
  }

  const tooShort = pw.length < 8;
  const mismatch = again.length > 0 && pw !== again;

  return (
    <Door
      workspace={workspace}
      heading="Choose a new password"
      subline={who ? `For ${who}.` : 'For your account.'}
    >
      <div style={{ marginBottom: 14 }}>
        <label style={label} htmlFor="pw">New password</label>
        <input
          id="pw"
          type="password"
          value={pw}
          onChange={(e) => { setPw(e.target.value); setError(''); }}
          autoComplete="new-password"
          autoFocus
          style={field}
        />
        <p style={{ fontSize: 12.5, color: FAINT, margin: '6px 0 0', lineHeight: 1.6, ...PROSE_WRAP }}>
          {noWidow('Eight characters or more. Nobody else has it, including us.')}
        </p>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={label} htmlFor="again">Type it again</label>
        <input
          id="again"
          type="password"
          value={again}
          onChange={(e) => { setAgain(e.target.value); setError(''); }}
          autoComplete="new-password"
          style={{ ...field, borderColor: mismatch ? '#E01B1B' : BORDER }}
        />
      </div>

      {error && (
        <p style={{ fontSize: 13.5, color: '#E01B1B', margin: '0 0 12px', lineHeight: 1.6, ...PROSE_WRAP }}>
          {error}
        </p>
      )}

      <button
        onClick={save}
        disabled={busy || tooShort || pw !== again}
        style={{
          width: '100%', background: busy || tooShort || pw !== again ? '#9198A1' : INK,
          color: '#fff', border: 'none', borderRadius: 999, padding: '12px',
          fontSize: 15, fontWeight: 500, fontFamily: 'inherit',
          cursor: busy || tooShort || pw !== again ? 'default' : 'pointer',
        }}
      >
        {busy ? 'Saving…' : 'Save and sign in'}
      </button>

      <p style={{ fontSize: 12.5, color: FAINT, margin: '14px 0 0', lineHeight: 1.7, textAlign: 'center', ...PROSE_WRAP }}>
        {noWidow(LINK_LASTS)}
      </p>
    </Door>
  );
}
