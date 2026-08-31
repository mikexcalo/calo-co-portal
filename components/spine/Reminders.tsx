'use client';

/**
 * Things to do on a date.
 *
 * The difference between this and a note is that a note waits to be found. It
 * sits on a page hoping somebody opens it on the right day. A reminder has a
 * date, so it comes and finds you on Today.
 *
 * Quick dates rather than a calendar picker, because the honest answer to
 * "when" is almost always "tomorrow", "next week" or "in a month", and making
 * somebody operate a date grid to say "next week" is how reminders stop
 * getting set.
 */

import { useCallback, useEffect, useState } from 'react';
import supabase from '@/lib/supabase';
import { Button, C, Card, Check, Empty, SectionLabel, inputStyle, shortDate } from './ui';

interface Reminder {
  id: string;
  body: string;
  due_on: string;
  done_at: string | null;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const plus = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return iso(d);
};

/** How people actually answer "when". */
const QUICK: Array<[string, () => string]> = [
  ['Tomorrow', () => plus(1)],
  ['In 3 days', () => plus(3)],
  ['Next week', () => plus(7)],
  ['In a month', () => plus(30)],
];

export function Reminders({
  orgId,
  customerId,
  jobId,
}: {
  orgId: string;
  customerId?: string;
  jobId?: string;
}) {
  const [rows, setRows] = useState<Reminder[]>([]);
  const [body, setBody] = useState('');
  const [due, setDue] = useState(plus(1));
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);

  const load = useCallback(async () => {
    let q = supabase
      .from('reminders')
      .select('id, body, due_on, done_at')
      .eq('org_id', orgId)
      .order('due_on');
    if (customerId) q = q.eq('customer_id', customerId);
    if (jobId) q = q.eq('job_id', jobId);
    const res = await q;
    if (!res.error) setRows((res.data ?? []) as Reminder[]);
  }, [orgId, customerId, jobId]);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    const { data: auth } = await supabase.auth.getUser();
    const res = await supabase.from('reminders').insert({
      org_id: orgId,
      customer_id: customerId ?? null,
      job_id: jobId ?? null,
      body: body.trim(),
      due_on: due,
      created_by: auth?.user?.id ?? null,
    });
    setBusy(false);
    if (res.error) { setError(res.error.message); return; }
    setBody('');
    setDue(plus(1));
    setAdding(false);
    await load();
  };

  const toggle = async (r: Reminder) => {
    setBusy(true);
    await supabase
      .from('reminders')
      .update({ done_at: r.done_at ? null : new Date().toISOString() })
      .eq('id', r.id);
    setBusy(false);
    await load();
  };

  const today = iso(new Date());
  const open = rows.filter((r) => !r.done_at);
  const done = rows.filter((r) => r.done_at);

  return (
    <div style={{ marginBottom: 26 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          marginBottom: 10,
        }}
      >
        <SectionLabel>Reminders ({open.length})</SectionLabel>
        <Button variant="ghost" onClick={() => setAdding((v) => !v)}>
          {adding ? 'Cancel' : 'Add a reminder'}
        </Button>
      </div>

      {adding && (
        <Card style={{ marginBottom: 8 }}>
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && body.trim()) add(); }}
            placeholder="Chase the deposit"
            autoFocus
            style={{ ...inputStyle, marginBottom: 10 }}
          />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
            {QUICK.map(([label, fn]) => {
              const value = fn();
              const on = due === value;
              return (
                <button
                  key={label}
                  onClick={() => setDue(value)}
                  style={{
                    padding: '5px 11px',
                    borderRadius: 20,
                    fontSize: 11.5,
                    border: `1px solid ${on ? C.accent : C.border}`,
                    background: on ? C.accentSoft : 'transparent',
                    color: on ? C.text : C.dim,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {label}
                </button>
              );
            })}
            <input
              type="date"
              value={due}
              min={today}
              onChange={(e) => setDue(e.target.value)}
              style={{ ...inputStyle, width: 150, fontSize: 12, padding: '5px 8px' }}
            />
          </div>
          {error && <div style={{ fontSize: 12, color: C.red, marginBottom: 8 }}>{error}</div>}
          <Button onClick={add} disabled={busy || !body.trim()}>
            {busy ? 'Saving…' : 'Remind me'}
          </Button>
        </Card>
      )}

      {open.length === 0 ? (
        !adding && <Card><Empty>Nothing outstanding.</Empty></Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {open.map((r) => {
            const late = r.due_on < today;
            const isToday = r.due_on === today;
            return (
              <div
                key={r.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 11,
                  border: `1px solid ${late ? `${C.amber}55` : C.border}`,
                  background: late ? C.amberSoft : C.panel,
                  borderRadius: 8,
                  padding: '10px 13px',
                }}
              >
                <button
                  onClick={() => toggle(r)}
                  disabled={busy}
                  aria-label="Mark done"
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                >
                  <Check done={false} size={18} />
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, color: C.text }}>{r.body}</div>
                  <div style={{ fontSize: 11.5, color: late ? C.amber : C.faint, marginTop: 2 }}>
                    {late ? 'Overdue · ' : isToday ? 'Today · ' : ''}
                    {shortDate(r.due_on)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {done.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <button
            onClick={() => setShowDone((v) => !v)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: C.faint,
              fontSize: 12,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {showDone ? 'Hide' : `Show ${done.length} done`}
          </button>
          {showDone && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
              {done.map((r) => (
                <div
                  key={r.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '6px 13px' }}
                >
                  <button
                    onClick={() => toggle(r)}
                    disabled={busy}
                    aria-label="Mark not done"
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                  >
                    <Check done size={18} />
                  </button>
                  <span
                    style={{
                      fontSize: 13,
                      color: C.faint,
                      textDecoration: 'line-through',
                    }}
                  >
                    {r.body}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
