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
    if (!res.error) setRows((res.data ?? []) as Row[]);
    setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!loaded || rows.length === 0) return null;

  return (
    <div style={{ marginBottom: 26 }}>
      <SectionLabel>Open ({rows.length})</SectionLabel>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {rows.map((r, i) => (
          <Card key={`${r.kind}-${i}`}>
            <div
              onClick={() => router.push(r.href)}
              style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap', cursor: 'pointer' }}
            >
              {/* Urgency as a mark rather than a color wash. Three is somebody
                  waiting on you or money not asked for; one is tidiness. */}
              <span
                style={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: r.urgency >= 3 ? C.amber : r.urgency === 2 ? C.borderStrong : C.border,
                }}
              />
              <span style={{ fontSize: 14.5, color: C.text }}>{r.who}</span>
              <span style={{ fontSize: 13.5, color: C.dim, flex: 1, minWidth: 200 }}>{r.what}</span>
              {r.age_days > 0 && (
                <span style={{ fontSize: 12, color: C.faint, fontVariantNumeric: 'tabular-nums' }}>
                  {r.age_days}d
                </span>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
