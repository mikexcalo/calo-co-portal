'use client';

/**
 * "Send me a note", on the document itself.
 *
 * It said "reply to the email this came from", which assumes the reader still
 * has it and that a mail thread is a record. This writes straight into
 * Feedback, with the proposal attached, so the question arrives where every
 * other thing anybody has said arrives.
 */

import { useState } from 'react';

export function AskAbout({ token, accent }: { token: string; accent: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function send() {
    if (!text.trim()) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/estimates/note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, body: text }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'It did not send');
      setDone(true);
      setText('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div style={{ fontSize: 13.5, color: '#15803d', marginTop: 16 }}>
        Got it. I&apos;ll come back to you on that.
      </div>
    );
  }

  return (
    <div style={{ marginTop: 16 }} data-print-hide>
      {!open ? (
        <div style={{ fontSize: 13.5, color: '#666' }}>
          Something not looking right?{' '}
          <button
            onClick={() => setOpen(true)}
            style={{
              background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              font: 'inherit', color: accent, textDecoration: 'underline',
            }}
          >
            Send me a note
          </button>
        </div>
      ) : (
        <div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
            placeholder="What looks wrong?"
            style={{
              width: '100%', minHeight: 88, padding: '10px 12px', fontSize: 14.5,
              fontFamily: 'inherit', border: '1px solid #e4e4e0', borderRadius: 9,
              color: '#222', resize: 'vertical',
            }}
          />
          {error && <div style={{ fontSize: 13, color: '#b91c1c', marginTop: 6 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10 }}>
            <button
              onClick={send}
              disabled={busy || !text.trim()}
              style={{
                background: accent, color: '#fff', border: 'none', borderRadius: 999,
                padding: '9px 20px', fontSize: 14, fontWeight: 500,
                cursor: text.trim() ? 'pointer' : 'default', fontFamily: 'inherit',
                opacity: text.trim() ? 1 : 0.5,
              }}
            >
              {busy ? 'Sending…' : 'Send it'}
            </button>
            <button
              onClick={() => { setOpen(false); setText(''); }}
              style={{ background: 'none', border: 'none', color: '#777', fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
