'use client';

/**
 * The Friday email.
 *
 * Clients rarely leave because the work was bad. They leave because they
 * stopped knowing what was happening, and a small doubt had nowhere to go.
 * What keeps them is somebody sending something on a Friday, and nobody does
 * it because writing it means reconstructing the week from memory.
 *
 * It is all already recorded. The brief says where things stand, the plan says
 * what moved, the invoices say what was billed. This assembles it, shows you
 * what it decided to leave out, and sends nothing until you have read it.
 */

import { useState } from 'react';
import supabase from '@/lib/supabase';
import { Button, C, Card, SectionLabel, inputStyle } from './ui';
import { OutboundCheck } from './OutboundCheck';

interface Draft {
  subject: string;
  body: string;
  asks: string[];
  withheld: string[];
  to: string | null;
}

export function ClientUpdate({ customerId, clientName }: { customerId: string; clientName: string }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [subject, setSubject] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const write = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/updates/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId }),
      });
      const raw = await res.text();
      let data: Draft & { error?: string } = {} as Draft;
      try { data = raw ? JSON.parse(raw) : ({} as Draft); } catch { /* handled below */ }
      if (!res.ok || !data.body) { setError(data.error ?? 'Could not write that.'); }
      else {
        setDraft(data);
        setSubject(data.subject);
        // The asks go in the body rather than a separate list, because an
        // email with a footer of demands reads like a form.
        setText([data.body, ...(data.asks ?? [])].join('\n\n'));
      }
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };

  const send = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch('/api/updates/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId, send: true, subject, text }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data.error ?? 'Could not send it.'); return; }
    setSent(true);
    setDraft(null);
  };

  if (sent) {
    return (
      <div style={{ marginBottom: 22, fontSize: 13.5, color: C.green }}>
        Update sent and logged. That also clears the waiting flag.
      </div>
    );
  }

  if (!draft) {
    return (
      <div style={{ marginBottom: 22 }}>
        <button
          onClick={write}
          disabled={busy}
          style={{
            border: `1px dashed ${C.border}`, background: 'transparent', borderRadius: 9,
            padding: '11px 14px', width: '100%', textAlign: 'left', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 13.5, color: C.dim,
          }}
        >
          {busy
            ? 'Writing…'
            : `Write ${clientName} an update from where things stand. You read it before it goes.`}
        </button>
        {error && <div style={{ fontSize: 13, color: C.red, marginTop: 8 }}>{error}</div>}
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 22 }}>
      <SectionLabel>Update for {clientName}</SectionLabel>
      <Card>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          style={{ ...inputStyle, fontWeight: 500, marginBottom: 10 }}
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          style={{ ...inputStyle, lineHeight: 1.7, resize: 'vertical', marginBottom: 12 }}
        />

        <OutboundCheck text={`${subject}\n\n${text}`} customerId={customerId} label="about to be sent" />

        {/* What it decided not to say, named so you can disagree. The brief's
            stuck line usually blames the client, which is true, useful to you,
            and not what you send. */}
        {draft.withheld.length > 0 && (
          <div style={{ fontSize: 12.5, color: C.faint, marginBottom: 12, lineHeight: 1.6, maxWidth: 620 }}>
            Left out as internal: {draft.withheld.join('. ')}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button onClick={send} disabled={busy || !draft.to}>
            {busy ? 'Sending…' : draft.to ? `Send to ${draft.to}` : 'No email on file'}
          </Button>
          <Button variant="ghost" onClick={() => setDraft(null)}>Discard</Button>
        </div>
        {error && <div style={{ fontSize: 13, color: C.red, marginTop: 10 }}>{error}</div>}
      </Card>
    </div>
  );
}
