'use client';

/**
 * They agreed, but not in here.
 *
 * Mark approved by replying to the email. The platform's only route to
 * "accepted" was somebody pressing the button on the proposal itself, so the
 * record sat at "sent" while the work was agreed — and the invoice that
 * follows from it had nothing to point at.
 *
 * What makes a record survive a disagreement is not the status. It is the
 * channel, the address it came from, and the words they used, kept exactly as
 * written. A summary of an agreement is not evidence of one, so this stores
 * the reply verbatim and never paraphrases it.
 *
 * Mike's own framing: he trusts Mark, and will not always be dealing with
 * Mark.
 */

import { useState } from 'react';
import supabase from '@/lib/supabase';
import { save as saveOrFail } from '@/lib/spine/save';
import { Button, C, Field, Select, Sheet, inputStyle } from './ui';

const VIA = [
  { value: 'email', label: 'Replied to the email' },
  { value: 'phone', label: 'Said so on the phone' },
  { value: 'in_person', label: 'Agreed in person' },
  { value: 'paper', label: 'Signed on paper' },
];

export function SaidYesElsewhere({
  estimateId,
  jobId,
  customerId,
  orgId,
  clientName,
  defaultName,
  defaultEmail,
  onDone,
  onClose,
}: {
  estimateId: string;
  jobId: string | null;
  customerId: string | null;
  orgId: string;
  clientName: string;
  defaultName?: string | null;
  defaultEmail?: string | null;
  onDone: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(defaultName ?? '');
  const [email, setEmail] = useState(defaultEmail ?? '');
  const [via, setVia] = useState('email');
  const [words, setWords] = useState('');
  const [when, setWhen] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);

    const res = await saveOrFail(
      supabase.from('estimates').update({
        status: 'accepted',
        decided_at: new Date(`${when}T12:00:00`).toISOString(),
        decided_by_name: name.trim(),
        decided_by_email: email.trim() || null,
        decided_via: via,
        decided_words: words.trim() || null,
      }).eq('id', estimateId)
    );

    if (!res.error && jobId) {
      await supabase.from('jobs').update({ status: 'won' }).eq('id', jobId);
    }

    /* On the client's record too, because that is where somebody goes
       looking a year later, not into a proposal they have forgotten. */
    if (!res.error && customerId) {
      const label = VIA.find((v) => v.value === via)?.label ?? via;
      await supabase.from('customer_notes').insert({
        org_id: orgId,
        customer_id: customerId,
        job_id: jobId,
        kind: via === 'phone' || via === 'in_person' ? 'call' : 'email',
        source: 'imported',
        direction: 'in',
        happened_on: when,
        title: `Accepted the proposal — ${label.toLowerCase()}`,
        body:
          `${name.trim()}${email.trim() ? ` <${email.trim()}>` : ''}, ${when}.` +
          (words.trim() ? `\n\n"${words.trim()}"` : '\n\nNo wording recorded.'),
      });
    }

    setBusy(false);
    if (!res.error) { onDone(); onClose(); }
  };

  return (
    <Sheet title="They said yes elsewhere" onClose={onClose}>
      <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.6, marginBottom: 16, maxWidth: '54ch' }}>
        Records the agreement against {clientName} with how it reached you. The
        wording is kept exactly as they sent it, which is the part that matters
        if it is ever questioned.
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        <Field label="Who agreed">
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="Their name" autoFocus />
        </Field>

        <Field label="How it reached you">
          <Select value={via} onChange={setVia} options={VIA} />
        </Field>

        {(via === 'email') && (
          <Field label="The address it came from">
            <input value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} placeholder="them@theircompany.com" />
          </Field>
        )}

        <Field label="When">
          <input type="date" value={when} onChange={(e) => setWhen(e.target.value)} style={inputStyle} />
        </Field>

        <Field label={via === 'email' || via === 'paper' ? 'What they wrote, word for word' : 'What they said, as close as you can'}>
          <textarea
            value={words}
            onChange={(e) => setWords(e.target.value)}
            rows={5}
            style={{ ...inputStyle, minHeight: 110, lineHeight: 1.6, resize: 'vertical', fontFamily: 'inherit' }}
            placeholder={via === 'email' ? 'Paste the reply.' : 'Their words, not your summary of them.'}
          />
        </Field>
      </div>

      <div style={{ display: 'flex', gap: 9, marginTop: 18, alignItems: 'center' }}>
        <Button onClick={save} disabled={busy || !name.trim()}>
          {busy ? 'Recording…' : 'Record it'}
        </Button>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
      </div>
    </Sheet>
  );
}
