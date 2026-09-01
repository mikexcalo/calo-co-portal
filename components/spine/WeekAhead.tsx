'use client';

/**
 * This week, across every job.
 *
 * The question somebody actually opens the app with in the morning is "what is
 * happening today", not "what is the state of the Brown kitchen". Answering it
 * needs one list across all jobs, grouped by day, which is a different shape
 * from anything a per-job screen can show.
 *
 * Late work sits above the week rather than inside it. Something that should
 * have finished on Tuesday is not a Tuesday problem any more, it is a today
 * problem, and leaving it in Tuesday's column is how it stays missed.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { C, Card, Empty, SectionLabel } from './ui';

interface Row {
  id: string;
  job_id: string;
  job_name: string;
  customer_name: string | null;
  name: string;
  starts_on: string | null;
  ends_on: string | null;
  status: string;
  assignee: string | null;
  overdue: boolean;
}

const DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Local date as YYYY-MM-DD. toISOString would shift the day west of UTC. */
function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function WeekAhead() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [today, setToday] = useState<Date | null>(null);

  // Set on the client, because rendering "today" on the server gives whatever
  // day it is at the datacenter.
  useEffect(() => { setToday(new Date()); }, []);

  const load = useCallback(async () => {
    const res = await supabase.from('week_ahead').select('*');
    if (!res.error) setRows((res.data ?? []) as Row[]);
    setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!loaded || !today) return null;

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    return d;
  });

  const late = rows.filter((r) => r.overdue);
  const todayIso = iso(today);
  const endIso = iso(days[6]);

  // A step spanning several days appears on each of them, because it is work
  // in progress on every one of those days, not only on the day it started.
  const onDay = (d: string) =>
    rows.filter(
      (r) =>
        !r.overdue &&
        r.starts_on &&
        r.starts_on <= d &&
        (r.ends_on ?? r.starts_on) >= d
    );

  const anything = late.length > 0 || rows.some((r) => r.starts_on && r.starts_on <= endIso && (r.ends_on ?? r.starts_on) >= todayIso);

  if (!anything) {
    return (
      <div style={{ marginBottom: 26 }}>
        <SectionLabel>This week</SectionLabel>
        <Card><Empty>Nothing scheduled. Add steps to a job and they show up here.</Empty></Card>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 26 }}>
      <SectionLabel>This week</SectionLabel>

      {late.length > 0 && (
        <Card style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: C.red, marginBottom: 8 }}>
            Late ({late.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {late.map((r) => (
              <div
                key={r.id}
                onClick={() => router.push(`/jobs/${r.job_id}`)}
                style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', cursor: 'pointer' }}
              >
                <span style={{ fontSize: 14, color: C.text }}>{r.name}</span>
                <span style={{ fontSize: 12.5, color: C.faint }}>
                  {r.customer_name ?? r.job_name}
                </span>
                <span style={{ fontSize: 12.5, color: C.red, marginLeft: 'auto' }}>
                  due {r.ends_on}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {days.map((d, i) => {
            const key = iso(d);
            const items = onDay(key);
            if (items.length === 0) return null;
            return (
              <div
                key={key}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '76px minmax(0, 1fr)',
                  gap: 14,
                  padding: '12px 0',
                  borderTop: i === 0 ? 'none' : `1px solid ${C.border}`,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: i === 0 ? C.accent : C.text,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {d.getDate()}
                  </div>
                  <div style={{ fontSize: 12, color: C.faint }}>
                    {i === 0 ? 'Today' : DAY[d.getDay()].slice(0, 3)}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {items.map((r) => (
                    <div
                      key={r.id + key}
                      onClick={() => router.push(`/jobs/${r.job_id}`)}
                      style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', cursor: 'pointer' }}
                    >
                      <span
                        style={{
                          width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                          background: r.status === 'in_progress' ? C.accent : C.borderStrong,
                        }}
                      />
                      <span style={{ fontSize: 14, color: C.text }}>{r.name}</span>
                      <span style={{ fontSize: 12.5, color: C.faint }}>
                        {r.customer_name ?? r.job_name}
                        {r.assignee ? ` · ${r.assignee}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
