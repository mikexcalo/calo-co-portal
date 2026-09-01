'use client';

/**
 * The steps inside a job.
 *
 * A job had a start and an end and nothing between them, so the answer to
 * "where are we" lived in someone's head or in a text thread.
 *
 * Moving a date here moves everything waiting on it. That happens in the
 * database rather than in this component, which matters: the reason people
 * abandon a schedule is that one thing slips, nobody updates the eleven things
 * behind it, and within a week the schedule and the job disagree.
 */

import { useCallback, useEffect, useState } from 'react';
import supabase from '@/lib/supabase';
import { Button, C, Card, Empty, Pill, SectionLabel, inputStyle, shortDate } from './ui';

interface Task {
  id: string;
  name: string;
  starts_on: string | null;
  ends_on: string | null;
  status: 'not_started' | 'in_progress' | 'done' | 'blocked';
  assignee: string | null;
  depends_on: string | null;
  position: number;
}

const STATUS: Record<Task['status'], { label: string; tone: 'neutral' | 'blue' | 'green' | 'amber' | 'red' }> = {
  not_started: { label: 'Not started', tone: 'neutral' },
  in_progress: { label: 'Underway', tone: 'blue' },
  done: { label: 'Done', tone: 'green' },
  blocked: { label: 'Blocked', tone: 'red' },
};

const blank = { name: '', starts_on: '', ends_on: '', assignee: '', depends_on: '' };

export function Schedule({ orgId, jobId }: { orgId: string; jobId: string }) {
  const [rows, setRows] = useState<Task[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await supabase
      .from('job_tasks')
      .select('id, name, starts_on, ends_on, status, assignee, depends_on, position')
      .eq('job_id', jobId)
      .order('position');
    if (!res.error) setRows((res.data ?? []) as Task[]);
  }, [jobId]);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!draft.name.trim()) return;
    setBusy(true);
    setError(null);
    const res = await supabase.from('job_tasks').insert({
      org_id: orgId,
      job_id: jobId,
      name: draft.name.trim(),
      starts_on: draft.starts_on || null,
      ends_on: draft.ends_on || null,
      assignee: draft.assignee.trim() || null,
      depends_on: draft.depends_on || null,
      position: rows.length + 1,
    });
    setBusy(false);
    if (res.error) { setError(res.error.message); return; }
    setDraft(blank);
    setAdding(false);
    load();
  };

  /**
   * Reload after any date change, always.
   *
   * The row you edited is not the only one that moved. Trusting local state
   * here would show the correct new date on the step you touched and stale
   * dates on everything behind it, which is a worse lie than not updating at
   * all.
   */
  const patch = async (t: Task, changes: Partial<Task>) => {
    setBusy(true);
    const res = await supabase.from('job_tasks').update(changes).eq('id', t.id);
    setBusy(false);
    if (res.error) { setError(res.error.message); return; }
    load();
  };

  const remove = async (t: Task) => {
    await supabase.from('job_tasks').delete().eq('id', t.id);
    load();
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <SectionLabel>Schedule ({rows.length})</SectionLabel>
        <Button variant="ghost" onClick={() => setAdding((v) => !v)}>
          {adding ? 'Cancel' : 'Add a step'}
        </Button>
      </div>

      {adding && (
        <Card style={{ marginBottom: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Drywall"
              autoFocus
              style={inputStyle}
            />
            <input
              type="date"
              value={draft.starts_on}
              onChange={(e) => setDraft({ ...draft, starts_on: e.target.value })}
              style={inputStyle}
            />
            <input
              type="date"
              value={draft.ends_on}
              onChange={(e) => setDraft({ ...draft, ends_on: e.target.value })}
              style={inputStyle}
            />
            <input
              value={draft.assignee}
              onChange={(e) => setDraft({ ...draft, assignee: e.target.value })}
              placeholder="Who is doing it"
              style={inputStyle}
            />
            {/* Free text on purpose: the drywall crew has no login and never
                will, and demanding an account before a name can be written
                down is how a schedule ends up half filled in. */}
            <select
              value={draft.depends_on}
              onChange={(e) => setDraft({ ...draft, depends_on: e.target.value })}
              style={inputStyle}
            >
              <option value="">Starts on its own</option>
              {rows.map((r) => <option key={r.id} value={r.id}>After {r.name}</option>)}
            </select>
          </div>
          <div style={{ marginTop: 10 }}>
            <Button onClick={add} disabled={busy || !draft.name.trim()}>
              {busy ? 'Adding…' : 'Add'}
            </Button>
          </div>
        </Card>
      )}

      {rows.length === 0 ? (
        <Card>
          <Empty>
            No steps yet. Add the ones that have dates and the rest can wait.
          </Empty>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {rows.map((t) => {
            const late = t.ends_on && t.ends_on < today && t.status !== 'done';
            const waiting = rows.find((r) => r.id === t.depends_on);
            return (
              <Card key={t.id}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 150 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 500, color: C.text }}>{t.name}</div>
                    <div style={{ fontSize: 12.5, color: C.faint, marginTop: 2 }}>
                      {[t.assignee, waiting && `after ${waiting.name}`].filter(Boolean).join(' · ') || ' '}
                    </div>
                  </div>

                  <input
                    type="date"
                    value={t.starts_on ?? ''}
                    onChange={(e) => patch(t, { starts_on: e.target.value || null })}
                    style={{ ...inputStyle, width: 148, fontSize: 13, padding: '5px 8px' }}
                  />
                  <input
                    type="date"
                    value={t.ends_on ?? ''}
                    onChange={(e) => patch(t, { ends_on: e.target.value || null })}
                    style={{
                      ...inputStyle,
                      width: 148,
                      fontSize: 13,
                      padding: '5px 8px',
                      color: late ? C.red : C.text,
                    }}
                  />

                  <select
                    value={t.status}
                    onChange={(e) => patch(t, { status: e.target.value as Task['status'] })}
                    style={{ ...inputStyle, width: 132, fontSize: 13, padding: '5px 8px' }}
                  >
                    {(Object.keys(STATUS) as Task['status'][]).map((k) => (
                      <option key={k} value={k}>{STATUS[k].label}</option>
                    ))}
                  </select>

                  {late && <Pill tone="red">late</Pill>}

                  <button
                    onClick={() => remove(t)}
                    aria-label={`Remove ${t.name}`}
                    style={{
                      width: 26, height: 26, borderRadius: 6,
                      border: `1px solid ${C.border}`, background: 'transparent',
                      color: C.faint, fontSize: 14, lineHeight: 1, cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    ×
                  </button>
                </div>
              </Card>
            );
          })}
          <div style={{ fontSize: 12.5, color: C.faint, marginTop: 4 }}>
            Move an end date and everything waiting on it moves with it.
          </div>
        </div>
      )}

      {error && <div style={{ fontSize: 13, color: C.red, marginTop: 8 }}>{error}</div>}
    </div>
  );
}
