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
  opportunity?: string;
  offer?: string;
  buyers?: string;
  edge?: string;
  economics?: string;
  gtm?: string;
  constraints?: string;
  ours?: string;
}

/**
 * Eight questions a consultant is actually asked, in the order they get asked.
 *
 * The old four were who they are, what we are doing, where it has got to and
 * what is stuck. Every one of those is a place to put background, and
 * background is where specifics go to die: John wrote a clean summary of his
 * own opportunity and what survived the shape was his age.
 *
 * The test each of these had to pass is whether you can be wrong about it.
 * "Who they are" cannot be wrong. "How the money works" can, and being wrong
 * about it costs money.
 *
 * They are also the unit a transcript updates. A named field can be changed on
 * its own and left alone when a call says nothing about it. A prose blob can
 * only be rewritten whole, which is why nobody ever rewrites one.
 */
const FIELDS: Array<{ key: keyof BriefShape; label: string; ask: string }> = [
  { key: 'opportunity', label: 'The opportunity', ask: 'The thesis, ideally in their words. What they are building and why it can work.' },
  { key: 'offer', label: 'What they sell', ask: 'The offer, and the structure behind it. Who invoices, who holds stock, who carries the risk.' },
  { key: 'buyers', label: 'Who buys', ask: 'The segments, named. Which ones first and why those clear faster.' },
  { key: 'edge', label: 'Why them', ask: 'What they have that the alternative does not. Specifics, not adjectives.' },
  { key: 'economics', label: 'How the money works', ask: 'Rates, margins, what a unit of volume is worth. The number that sizes everything else.' },
  { key: 'gtm', label: 'How it goes to market', ask: 'The motion and the sequence. What happens in the first ninety days.' },
  { key: 'constraints', label: 'What they will not do', ask: 'Limits, hard rules and things they have refused. Usually where the work for us is.' },
  { key: 'ours', label: 'What we are doing', ask: 'Our scope, and what is still unagreed.' },
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
          Build the picture of {clientName}. Eight questions a consultant gets asked, so nobody
          has to read a timeline to answer one.
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
            {written.map((f) => (
              <div key={f.key}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.09em', color: C.faint, fontWeight: 600, marginBottom: 4 }}>
                  {f.label}
                </div>
                {/* Capped at a readable measure. Full width is the right shape
                    for the page and the wrong one for a paragraph: past about
                    seventy characters the eye loses the line. */}
                <p style={{ fontSize: 14.5, color: C.text, lineHeight: 1.65, margin: 0, maxWidth: '68ch' }}>
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
