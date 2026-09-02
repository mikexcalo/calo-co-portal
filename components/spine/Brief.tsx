'use client';

/**
 * The standing answer to "where are we with these people".
 *
 * Every agency worth working with keeps one of these and none of them call it
 * the same thing. The shape is always the same: who they are, what we are
 * doing, where it has got to, and what is stuck. One paragraph each, rewritten
 * in place rather than appended to, so it is never longer than a screen and
 * never out of date by more than the last person who touched it.
 *
 * The reason it beats a timeline: a timeline tells you what happened, which
 * you have to read in order and reconstruct. A brief tells you where you are,
 * which is the thing you actually wanted and the only thing you can hand to
 * somebody else.
 *
 * Four named fields rather than free text, for the same reason the framework
 * uses them. The shape is the useful part, and a blank section is a visible
 * gap instead of something quietly left out.
 */

import { useCallback, useEffect, useState } from 'react';
import supabase from '@/lib/supabase';
import { Button, C, Card, SectionLabel, inputStyle, shortDate } from './ui';

interface BriefShape {
  who?: string;
  doing?: string;
  where?: string;
  stuck?: string;
}

const FIELDS: Array<{ key: keyof BriefShape; label: string; ask: string }> = [
  { key: 'who', label: 'Who they are', ask: 'The business in two sentences, as you would describe it to somebody who has never heard of them.' },
  { key: 'doing', label: 'What we are doing', ask: 'The engagement in a sentence. What they are paying for, or what you agreed to.' },
  { key: 'where', label: 'Where it has got to', ask: 'The state of play. Rewrite this rather than adding to it.' },
  { key: 'stuck', label: 'What is stuck', ask: 'What you are waiting on, and from whom. Blank is a fine answer.' },
];

export function Brief({ customerId, clientName }: { customerId: string; clientName: string }) {
  const [brief, setBrief] = useState<BriefShape>({});
  const [updated, setUpdated] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const res = await supabase
      .from('customers')
      .select('brief, brief_updated_at')
      .eq('id', customerId)
      .maybeSingle();
    if (res.data) {
      setBrief((res.data.brief ?? {}) as BriefShape);
      setUpdated(res.data.brief_updated_at ?? null);
    }
    setLoaded(true);
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setBusy(true);
    await supabase.from('customers').update({ brief }).eq('id', customerId);
    setBusy(false);
    setEditing(false);
    load();
  };

  if (!loaded) return null;

  const written = FIELDS.filter((f) => brief[f.key]?.trim());

  /**
   * Nothing written yet shows one line, not four empty boxes.
   *
   * The point of the brief is that it is the first thing you read. An unwritten
   * one that takes up half the screen teaches you to scroll past the place the
   * answer will eventually be.
   */
  if (written.length === 0 && !editing) {
    return (
      <div style={{ marginBottom: 22 }}>
        <button
          onClick={() => setEditing(true)}
          style={{
            border: `1px dashed ${C.border}`, background: 'transparent',
            borderRadius: 9, padding: '11px 14px', width: '100%', textAlign: 'left',
            fontSize: 13.5, color: C.faint, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Write the brief for {clientName}. Four lines that mean nobody has to read the timeline
          to know where this stands.
        </button>
      </div>
    );
  }

  const stale = updated && Date.now() - new Date(updated).getTime() > 1000 * 60 * 60 * 24 * 45;

  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <SectionLabel>Brief</SectionLabel>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {updated && (
            <span style={{ fontSize: 12, color: stale ? C.amber : C.faint }}>
              {stale ? 'not touched since ' : 'updated '}{shortDate(updated)}
            </span>
          )}
          <Button variant="ghost" onClick={() => setEditing((v) => !v)}>
            {editing ? 'Cancel' : 'Edit'}
          </Button>
        </div>
      </div>

      <Card>
        {editing ? (
          <>
            {FIELDS.map((f) => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11.5, color: C.dim, marginBottom: 5, fontWeight: 500 }}>
                  {f.label}
                </div>
                <textarea
                  value={brief[f.key] ?? ''}
                  onChange={(e) => setBrief({ ...brief, [f.key]: e.target.value })}
                  rows={2}
                  placeholder={f.ask}
                  style={{ ...inputStyle, lineHeight: 1.6, resize: 'vertical' }}
                />
              </div>
            ))}
            <Button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {written.map((f) => (
              <div key={f.key}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.09em', color: C.faint, fontWeight: 600, marginBottom: 4 }}>
                  {f.label}
                </div>
                <p style={{ fontSize: 14.5, color: C.text, lineHeight: 1.65, margin: 0, maxWidth: 640 }}>
                  {brief[f.key]}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
