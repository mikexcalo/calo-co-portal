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

interface Person { name: string; title: string | null; email: string }

interface Draft {
  subject: string;
  body: string;
  asks: string[];
  withheld: string[];
  people: Person[];
  from: string;
  testDomain: boolean;
}

export function ClientUpdate({ customerId, clientName }: { customerId: string; clientName: string }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [subject, setSubject] = useState('');
  const [text, setText] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<Person | null>(null);
  const [error, setError] = useState<string | null>(null);

  const person = draft?.people.find((p) => p.email === to) ?? null;

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
        // Whoever is marked primary, which is who you would have picked.
        setTo(data.people?.[0]?.email ?? '');
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
    if (!person) return;
    setBusy(true);
    setError(null);
    const res = await fetch('/api/updates/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId, send: true, subject, text, to }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data.error ?? 'Could not send it.'); return; }
    setSent(person);
    setDraft(null);
  };

  if (sent) {
    return (
      <div style={{ marginBottom: 22, fontSize: 13.5, color: C.green, lineHeight: 1.6 }}>
        {/* Named, because "sent" without a name is the part you would want to
            check afterwards and could not. */}
        Emailed to {sent.name} at {sent.email}. Filed under Activity, and that
        clears the waiting flag.
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
            : `Draft an email to someone at ${clientName} from where things stand. You pick who, and read it, before it sends.`}
        </button>
        {error && <div style={{ fontSize: 13, color: C.red, marginTop: 8 }}>{error}</div>}
      </div>
    );
  }

  /** The header rows of an email, so it is read as one. */
  const row = {
    display: 'flex', alignItems: 'baseline', gap: 10,
    padding: '8px 0', borderBottom: `1px solid ${C.border}`,
  } as const;
  const key = { fontSize: 11.5, color: C.faint, width: 52, flexShrink: 0, textTransform: 'uppercase' as const, letterSpacing: '.05em' };

  return (
    <div style={{ marginBottom: 22 }}>
      <SectionLabel>Email to a person at {clientName}</SectionLabel>
      <Card>
        {/* Who it is going to, first and by name.
            This said "Update for Colette Intelligence" over a button reading
            "Send to frank@askcolette.ai", so the one thing it did not say was
            that an email was about to reach a named human being. */}
        <div style={row}>
          <span style={key}>To</span>
          {draft.people.length === 0 ? (
            <span style={{ fontSize: 13.5, color: C.amber }}>
              Nobody at {clientName} has an email on file. Add one under People.
            </span>
          ) : (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', flex: 1 }}>
              <select
                value={to}
                onChange={(e) => setTo(e.target.value)}
                style={{
                  background: 'transparent', color: C.text, border: 'none', padding: 0,
                  fontSize: 14.5, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
                }}
              >
                {draft.people.map((p) => (
                  <option key={p.email} value={p.email}>{p.name}</option>
                ))}
              </select>
              <span style={{ fontSize: 13, color: C.dim }}>{person?.email}</span>
              {person?.title && <span style={{ fontSize: 12.5, color: C.faint }}>{person.title}</span>}
            </div>
          )}
        </div>

        <div style={row}>
          <span style={key}>From</span>
          <span style={{ fontSize: 13, color: C.dim }}>{draft.from}</span>
        </div>

        <div style={{ ...row, borderBottom: `1px solid ${C.border}` }}>
          <span style={key}>Subject</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            style={{
              ...inputStyle, border: 'none', background: 'transparent',
              padding: 0, fontWeight: 500, flex: 1,
            }}
          />
        </div>

        {/* Said before the send, not discovered after it. Resend's shared
            address only ever delivers to your own inbox. */}
        {draft.testDomain && (
          <div
            style={{
              fontSize: 12.5, color: C.amber, lineHeight: 1.6, margin: '12px 0 0',
              padding: '8px 11px', borderRadius: 7,
              background: C.amberSoft, border: `1px solid ${C.amber}44`,
            }}
          >
            Sending from the mail service's shared address, which only delivers to your own
            inbox. To reach {person?.name ?? 'a client'}, verify calo.company with Resend and
            set the from address.
          </div>
        )}

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          style={{ ...inputStyle, lineHeight: 1.7, resize: 'vertical', margin: '12px 0' }}
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
          <Button onClick={send} disabled={busy || !person}>
            {busy ? 'Sending…' : person ? `Email ${person.name}` : 'Nobody to send to'}
          </Button>
          <Button variant="ghost" onClick={() => setDraft(null)}>Discard</Button>
        </div>
        {error && <div style={{ fontSize: 13, color: C.red, marginTop: 10 }}>{error}</div>}
      </Card>
    </div>
  );
}
