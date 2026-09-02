'use client';

/**
 * The questions you asked, and what came back.
 *
 * These were seven thousand characters of prose inside a document, which can
 * only be read from the top. An answer is not a paragraph in a file: it is a
 * question somebody asked, about a subject, that informs a decision. Kept that
 * way it can be filtered, quoted, and pointed at from the module it feeds.
 *
 * Flagged is the useful column and it means one of two things: the answer
 * changes what you would do, or it is thin and needs asking again. Both are
 * reasons to come back, which is the only reason to mark anything.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import supabase from '@/lib/supabase';
import { FRAMEWORK } from '@/lib/spine/framework';
import { Button, C, Card, Pill, SectionLabel } from './ui';

interface Row {
  id: string;
  subject: string | null;
  question: string;
  answer: string | null;
  informs: string | null;
  flagged: boolean;
  note: string | null;
  position: number;
}

export function Discovery({ customerId }: { customerId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [subject, setSubject] = useState<string>('all');
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const res = await supabase
      .from('discovery')
      .select('id, subject, question, answer, informs, flagged, note, position')
      .eq('customer_id', customerId)
      .order('position');
    if (!res.error) setRows((res.data ?? []) as Row[]);
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  const flag = async (r: Row) => {
    setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, flagged: !x.flagged } : x)));
    await supabase.from('discovery').update({ flagged: !r.flagged }).eq('id', r.id);
  };

  const subjects = useMemo(
    () => Array.from(new Set(rows.map((r) => r.subject).filter(Boolean))) as string[],
    [rows]
  );

  const shown = rows.filter(
    (r) => (subject === 'all' || r.subject === subject) && (!onlyFlagged || r.flagged)
  );

  if (rows.length === 0) return null;

  const moduleName = (id: string | null) =>
    id ? FRAMEWORK.find((m) => m.id === id)?.name ?? id : null;

  const flaggedCount = rows.filter((r) => r.flagged).length;

  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <button
          onClick={() => setOpen((v) => !v)}
          style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <span style={{ fontSize: 10, color: C.faint }}>{open ? '▼' : '▶'}</span>
          <SectionLabel>What they told you ({rows.length})</SectionLabel>
        </button>
        {flaggedCount > 0 && (
          <span style={{ fontSize: 12.5, color: C.amber }}>{flaggedCount} worth revisiting</span>
        )}
      </div>

      {!open ? (
        /* Folded to the flagged ones, because those are the reason to open it. */
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {rows.filter((r) => r.flagged).slice(0, 3).map((r) => (
              <div key={r.id} style={{ fontSize: 13.5, color: C.dim, lineHeight: 1.55 }}>
                <span style={{ color: C.text }}>{r.subject}</span> · {r.note ?? r.question}
              </div>
            ))}
            <button
              onClick={() => setOpen(true)}
              style={{ border: 'none', background: 'none', padding: 0, textAlign: 'left', fontSize: 12.5, color: C.blue, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Read all {rows.length}
            </button>
          </div>
        </Card>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {['all', ...subjects].map((s) => (
              <button
                key={s}
                onClick={() => setSubject(s)}
                style={{
                  border: `1px solid ${subject === s ? C.accent : C.border}`,
                  background: subject === s ? C.accentSoft : 'transparent',
                  color: subject === s ? C.text : C.dim,
                  borderRadius: 20, padding: '5px 12px', fontSize: 12.5,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {s === 'all' ? 'Everything' : s}
              </button>
            ))}
            <button
              onClick={() => setOnlyFlagged((v) => !v)}
              style={{
                border: `1px solid ${onlyFlagged ? C.amber : C.border}`,
                background: onlyFlagged ? C.amberSoft : 'transparent',
                color: onlyFlagged ? C.text : C.dim,
                borderRadius: 20, padding: '5px 12px', fontSize: 12.5,
                cursor: 'pointer', fontFamily: 'inherit', marginLeft: 'auto',
              }}
            >
              Flagged only
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {shown.map((r) => (
              <Card key={r.id}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 6 }}>
                  <span style={{ fontSize: 11.5, color: C.faint }}>{r.subject}</span>
                  {r.informs && <Pill tone="blue">{moduleName(r.informs)}</Pill>}
                  <button
                    onClick={() => flag(r)}
                    style={{
                      marginLeft: 'auto', border: 'none', background: 'none', padding: 0,
                      fontSize: 12, color: r.flagged ? C.amber : C.faint,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    {r.flagged ? 'flagged' : 'flag it'}
                  </button>
                </div>

                <div style={{ fontSize: 14, color: C.text, lineHeight: 1.5, marginBottom: 7 }}>
                  {r.question}
                </div>

                {r.answer && (
                  <div
                    style={{
                      fontSize: 13.5, color: C.dim, lineHeight: 1.7,
                      paddingLeft: 12, borderLeft: `2px solid ${C.border}`, maxWidth: 680,
                    }}
                  >
                    {r.answer}
                  </div>
                )}

                {/* Yours, not theirs. What the answer means rather than what it said. */}
                {r.note && (
                  <div style={{ fontSize: 13, color: C.blue, marginTop: 8, lineHeight: 1.6, maxWidth: 660 }}>
                    {r.note}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
