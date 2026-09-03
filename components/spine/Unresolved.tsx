'use client';

/**
 * What is actually open.
 *
 * Today said nothing needed you while a client was waiting, a plan had nobody
 * assigned, and six findings sat flagged and unused. It was not broken: it was
 * measuring money, there is no money in here yet, and so every check it ran
 * passed. The screen whose whole job is to say what needs you was answering a
 * narrower question than it appeared to.
 *
 * This reads one view of everything unresolved, which means a new kind of
 * unresolved thing appears here by existing rather than by somebody
 * remembering to add a check for it.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { C, Card, SectionLabel } from './ui';

interface Row {
  kind: string;
  who: string;
  what: string;
  href: string;
  age_days: number;
  urgency: number;
}

/**
 * The verb, per kind of open thing.
 *
 * Three rows reading "16 steps planned and nobody assigned to any of them"
 * state a fact and stop. Every one of them was already a link, and nothing on
 * screen said so, so the list read as a wall of complaints rather than a queue.
 * A row you can act on has to say what the act is.
 */
const DO: Record<string, string> = {
  waiting: 'Chase it',
  unassigned: 'Split the work',
  findings: 'Use them',
};

export function Unresolved() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const res = await supabase
      .from('unresolved')
      .select('*')
      .order('urgency', { ascending: false })
      .order('age_days', { ascending: false });
    /**
     * Only what is yours to move.
     *
     * `unassigned` counted a client's own setup steps, and `findings` counted
     * notes from their documents. Neither is a thing you do: John's plan being
     * unassigned is John's problem, and a daily reminder of it is noise that
     * teaches you to ignore the whole list.
     */
    const mine = ((res.data ?? []) as Row[]).filter((r) => r.kind === 'waiting');
    if (!res.error) setRows(mine);
    setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!loaded || rows.length === 0) return null;

  return (
    <div style={{ marginBottom: 26 }}>
      <SectionLabel>Open ({rows.length})</SectionLabel>

      <Card>
        {rows.map((r, i) => (
          <div
            key={`${r.kind}-${i}`}
            onClick={() => router.push(r.href)}
            style={{
              display: 'flex', gap: 11, alignItems: 'center', flexWrap: 'wrap',
              padding: '9px 0', cursor: 'pointer',
              borderTop: i === 0 ? 'none' : `1px solid ${C.border}`,
            }}
          >
            <span
              style={{
                width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                background: r.urgency >= 2 ? C.amber : C.borderStrong,
              }}
            />
            <span style={{ fontSize: 13.5, color: C.text, flexShrink: 0 }}>{r.who}</span>
            <span style={{ fontSize: 13.5, color: C.dim, flex: 1, minWidth: 140 }}>{r.what}</span>
            <span style={{ fontSize: 12, color: C.faint, flexShrink: 0 }}>{r.age_days}d</span>
            <span style={{ fontSize: 12.5, color: C.accent, flexShrink: 0 }}>
              {DO[r.kind] ?? 'Open'} →
            </span>
          </div>
        ))}
      </Card>
    </div>
  );
}
