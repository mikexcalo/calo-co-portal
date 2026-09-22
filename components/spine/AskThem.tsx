'use client';

/**
 * Ask a client to do something.
 *
 * The things a client has to do — buy the domain, send the logo, confirm the
 * rate — were living in email, where they are read once and then gone. This
 * puts them in their bell and on their home screen, where the thing stays
 * until they deal with it.
 *
 * Only offered for a client who actually has a workspace. Asking somebody who
 * cannot sign in is a message into a room with nobody in it.
 */

import { useState } from 'react';
import supabase from '@/lib/supabase';
import { human } from '@/lib/spine/errors';
import { Button, C, Card, inputStyle } from './ui';

export function AskThem({ orgId, clientName }: { orgId: string; clientName: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function send() {
    if (!title.trim()) { setError('Say what you are asking for.'); return; }
    setBusy(true); setError('');
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) { setError('Your sign-in has expired. Reload the page.'); setBusy(false); return; }

      const res = await fetch('/api/asks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orgId, title: title.trim(), detail: detail.trim() || undefined }),
      });
      const b = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { setError(human(b.error ?? '', 'That did not send.')); setBusy(false); return; }

      setSent(true); setTitle(''); setDetail('');
    } catch (e) {
      setError(human(e, 'That did not send.'));
    }
    setBusy(false);
  }

  if (!open) {
    return (
      <Button variant="ghost" onClick={() => { setOpen(true); setSent(false); }}>
        Ask them for something
      </Button>
    );
  }

  return (
    <Card style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 15.5, fontWeight: 600, color: C.text }}>
        Ask {clientName} for something
      </div>
      <p style={{ fontSize: 13, color: C.faint, margin: '4px 0 12px', maxWidth: '58ch' }}>
        It shows up in their notifications and on their home screen, and stays there until
        they mark it done.
      </p>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What you need them to do"
        style={inputStyle}
        autoFocus
      />
      <div style={{ marginTop: 8 }}>
        <textarea
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder="Anything they need in order to do it, where to go, what to pick, what it costs"
          rows={3}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
        />
      </div>

      {error && <p style={{ fontSize: 12.5, color: C.red, margin: '10px 0 0' }}>{error}</p>}
      {sent && <p style={{ fontSize: 12.5, color: C.green, margin: '10px 0 0' }}>Sent. It is on their screen now.</p>}

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 14 }}>
        <Button onClick={send} disabled={busy || !title.trim()}>
          {busy ? 'Sending…' : sent ? 'Ask for something else' : 'Send it'}
        </Button>
        <button
          onClick={() => setOpen(false)}
          style={{ background: 'transparent', border: 'none', padding: 0, color: C.faint, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          {sent ? 'Done' : 'Cancel'}
        </button>
      </div>
    </Card>
  );
}
