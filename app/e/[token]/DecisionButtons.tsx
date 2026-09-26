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
import { human } from '@/lib/spine/errors';

/**
 * Who is accountable for this.
 *
 * An elite proposal says who you will actually be dealing with: the company
 * is who invoices you, a name is who answers the phone when something goes
 * wrong. Renders nothing when nobody is on the record, rather than an empty
 * circle over a blank line.
 */
function Who({
  owner,
  business,
}: {
  owner?: { fullName: string; firstName: string; initials: string } | null;
  business?: string | null;
}) {
  if (!owner) return null;
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 11,
        marginTop: 18, paddingTop: 16, borderTop: '1px solid #e4e4e0',
      }}
    >
      <span
        style={{
          width: 34, height: 34, borderRadius: 999, flexShrink: 0,
          background: '#f0f0ed', color: '#555',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12.5, fontWeight: 700,
        }}
      >
        {owner.initials}
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600, color: '#111' }}>
          {owner.fullName}
        </span>
        {business && (
          <span style={{ display: 'block', fontSize: 13.5, color: '#666' }}>Owner, {business}</span>
        )}
      </span>
    </div>
  );
}

export function DecisionButtons({
  token,
  accent,
  accentInk = '#FFFFFF',
  business,
  owner,
  selected = [],
}: {
  token: string;
  accent: string;
  /** Readable ink on the client's colour. A pale brand takes black. */
  accentInk?: string;
  /** Whose terms are being agreed to, named in the sentence. */
  business?: string | null;
  /** Who is accountable for this, shown by name under the action. */
  owner?: { fullName: string; firstName: string; initials: string } | null;
  /**
   * Optional lines the customer ticked. Sent with the acceptance rather than
   * saved as they click, so a half-considered selection on a page somebody
   * then closes never becomes a record of what they agreed to.
   */
  selected?: string[];
}) {
  /*
    The form, not a button that reveals the form.

    Accepting was two steps: press "Accept this estimate", then type a name.
    The second step is where the actual decision is recorded, so the first was
    a door in front of a door - and it meant the thing a customer came to do
    was never visible on arrival. Name, tick, Accept, all on the panel.
  */
  const [mode, setMode] = useState<'idle' | 'accepting' | 'declining'>('accepting');
  const [name, setName] = useState('');
  /*
    A tick, not just a typed name.

    The name alone records who pressed the button. The checkbox records that
    they were told what they were agreeing to, in a sentence naming the
    business whose terms they are - which is the part somebody would want to
    point at later.
  */
  const [agreed, setAgreed] = useState(false);
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
      setError(human((e as Error).message));
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

  /* Both, or neither. A name with no tick is a signature nobody read; a tick
     with no name is a record of nobody. */
  const ready = name.trim().length >= 2 && agreed;

  if (mode === 'accepting') {
    return (
      <div>
        <label style={{ display: 'block', fontSize: 14, color: '#444', marginBottom: 7 }}>
          Your full name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={input}
          placeholder="Your full name"
          autoFocus
        />
        <label
          style={{
            display: 'flex', alignItems: 'flex-start', gap: 11, marginTop: 14,
            fontSize: 14.5, color: '#333', lineHeight: 1.5, cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            style={{ width: 19, height: 19, marginTop: 1, flexShrink: 0, accentColor: accent, cursor: 'pointer' }}
          />
          <span>I agree to this {business ? `and to ${business}'s terms` : 'and to the terms above'}.</span>
        </label>

        {error && <div style={{ color: '#b91c1c', fontSize: 13.5, marginTop: 8 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <button
            onClick={() => send('accepted')}
            disabled={busy || !ready}
            style={{
              background: accent, color: accentInk, border: 'none', borderRadius: 999,
              minHeight: 48, padding: '0 22px', fontSize: 16, fontWeight: 600,
              cursor: busy || !ready ? 'not-allowed' : 'pointer',
              opacity: busy || !ready ? 0.5 : 1, fontFamily: 'inherit',
            }}
          >
            {busy ? 'One moment…' : 'Accept'}
          </button>
          <button
            onClick={() => setMode('declining')}
            style={{
              background: 'transparent', border: 'none', borderRadius: 999,
              minHeight: 48, padding: '0 14px', fontSize: 15, color: '#666',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            No thanks
          </button>
        </div>

        <Who owner={owner} business={business} />
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
              background: 'transparent', border: '1px solid #d8d8d2', borderRadius: 999,
              padding: '12px 20px', fontSize: 15, color: '#555',
              cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit',
            }}
          >
            {busy ? 'One moment…' : 'Send'}
          </button>
          {/* Back to the accept form, which is now the resting state. Going
              to 'idle' would land somebody on a screen they never saw on the
              way in. */}
          <button
            onClick={() => setMode('accepting')}
            style={{
              background: 'transparent', border: 'none', minHeight: 48, padding: '0 10px',
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
          background: accent, color: '#fff', border: 'none', borderRadius: 999,
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
