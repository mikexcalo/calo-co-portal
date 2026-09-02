'use client';

/**
 * Accept or decline, for someone with no account.
 *
 * Accepting asks for a name. Not for security — the token already proves they
 * had the link — but because "accepted by Nikhail Singh on 12 March" is worth
 * having on the record, and typing your name is a small, deliberate act that
 * makes an accidental tap unlikely.
 */

import { useState } from 'react';

export function DecisionButtons({
  token,
  accent,
  selected = [],
}: {
  token: string;
  accent: string;
  /**
   * Optional lines the customer ticked. Sent with the acceptance rather than
   * saved as they click, so a half-considered selection on a page somebody
   * then closes never becomes a record of what they agreed to.
   */
  selected?: string[];
}) {
  const [mode, setMode] = useState<'idle' | 'accepting' | 'declining'>('idle');
  const [name, setName] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (decision: 'accepted' | 'declined') => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/estimates/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, decision, name, reason, selected }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Could not record that');
      window.location.reload();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const input: React.CSSProperties = {
    width: '100%',
    padding: '11px 13px',
    fontSize: 15,
    border: '1px solid #d8d8d2',
    borderRadius: 8,
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  };

  if (mode === 'accepting') {
    return (
      <div>
        <label style={{ display: 'block', fontSize: 14, color: '#444', marginBottom: 7 }}>
          Type your name to accept this estimate
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={input}
          placeholder="Your full name"
          autoFocus
        />
        {error && <div style={{ color: '#b91c1c', fontSize: 13.5, marginTop: 8 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button
            onClick={() => send('accepted')}
            disabled={busy || name.trim().length < 2}
            style={{
              background: accent, color: '#fff', border: 'none', borderRadius: 8,
              padding: '12px 20px', fontSize: 15, fontWeight: 600,
              cursor: busy || name.trim().length < 2 ? 'not-allowed' : 'pointer',
              opacity: busy || name.trim().length < 2 ? 0.5 : 1, fontFamily: 'inherit',
            }}
          >
            {busy ? 'One moment…' : 'Accept estimate'}
          </button>
          <button
            onClick={() => setMode('idle')}
            style={{
              background: 'transparent', border: '1px solid #d8d8d2', borderRadius: 8,
              padding: '12px 18px', fontSize: 15, color: '#555', cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'declining') {
    return (
      <div>
        <label style={{ display: 'block', fontSize: 14, color: '#444', marginBottom: 7 }}>
          Anything you&apos;d like them to know? (optional)
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          style={{ ...input, minHeight: 74, resize: 'vertical' }}
          placeholder="Going a different direction, timing doesn't work, over budget…"
          autoFocus
        />
        {error && <div style={{ color: '#b91c1c', fontSize: 13.5, marginTop: 8 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button
            onClick={() => send('declined')}
            disabled={busy}
            style={{
              background: 'transparent', border: '1px solid #d8d8d2', borderRadius: 8,
              padding: '12px 20px', fontSize: 15, color: '#555',
              cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit',
            }}
          >
            {busy ? 'One moment…' : 'Send'}
          </button>
          <button
            onClick={() => setMode('idle')}
            style={{
              background: 'transparent', border: 'none', padding: '12px 8px',
              fontSize: 15, color: '#777', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <button
        onClick={() => setMode('accepting')}
        style={{
          background: accent, color: '#fff', border: 'none', borderRadius: 8,
          padding: '13px 24px', fontSize: 15.5, fontWeight: 600, cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        Accept this estimate
      </button>
      <button
        onClick={() => setMode('declining')}
        style={{
          background: 'transparent', border: 'none', padding: '13px 10px',
          fontSize: 14.5, color: '#777', cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        No thanks
      </button>
    </div>
  );
}
