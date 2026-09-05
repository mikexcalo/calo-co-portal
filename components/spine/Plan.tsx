'use client';

/**
 * The plan, as a consultant works it.
 *
 * John's sixteen setup steps were sitting in the schedule as a flat list with
 * every owner unassigned, which is the least useful form they could take. The
 * question in front of you is not "what are the steps", it is "which of these
 * am I doing, which is he doing, and what is actually next".
 *
 * So ownership is the first thing on every row and the thing you can change
 * fastest. A step nobody owns is called out rather than rendered quietly,
 * because an unowned step in a client plan is the single most reliable way for
 * a month to pass with nothing happening.
 *
 * Deliberately not a Gantt chart. Dates live in the schedule; this answers
 * order and ownership, which is what gets argued about on a call.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import supabase from '@/lib/supabase';
import { Button, C, Card, SectionLabel, inputStyle } from './ui';

type Owner = 'unassigned' | 'us' | 'client' | 'third_party';
type Status = 'not_started' | 'in_progress' | 'done' | 'blocked';

interface Step {
  id: string;
  job_id: string;
  name: string;
  owner: Owner;
  status: Status;
  position: number;
  note: string | null;
}

interface Job { id: string; name: string }

const OWNERS: { id: Owner; label: string; short: string }[] = [
  { id: 'us', label: 'Us', short: 'Us' },
  { id: 'client', label: 'Them', short: 'Them' },
  { id: 'third_party', label: 'Someone else', short: 'Other' },
  { id: 'unassigned', label: 'Nobody yet', short: '—' },
];

const STATUSES: { id: Status; label: string }[] = [
  { id: 'not_started', label: 'Not started' },
  { id: 'in_progress', label: 'Doing' },
  { id: 'done', label: 'Done' },
  { id: 'blocked', label: 'Blocked' },
];

export function Plan({ customerId, clientName }: { customerId: string; clientName: string }) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<Owner | 'all'>('all');
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const load = useCallback(async () => {
    const j = await supabase.from('jobs').select('id, name').eq('customer_id', customerId);
    const jobRows = (j.data ?? []) as Job[];
    setJobs(jobRows);
    if (jobRows.length === 0) { setSteps([]); setLoaded(true); return; }

    const t = await supabase
      .from('job_tasks')
      .select('id, job_id, name, owner, status, position, note')
      .in('job_id', jobRows.map((r) => r.id))
      .order('position');
    setSteps((t.data ?? []) as Step[]);
    setLoaded(true);
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  const set = async (id: string, patch: Partial<Step>) => {
    // Optimistic: changing an owner on a call should feel instant, and the
    // reload behind it corrects anything the database disagreed with.
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    await supabase.from('job_tasks').update(patch).eq('id', id);
    load();
  };

  const add = async () => {
    const name = draft.trim();
    if (!name || jobs.length === 0) return;
    const org = await supabase.from('jobs').select('org_id').eq('id', jobs[0].id).maybeSingle();
    await supabase.from('job_tasks').insert({
      org_id: (org.data as { org_id: string } | null)?.org_id,
      job_id: jobs[0].id,
      name,
      owner: 'us',
      status: 'not_started',
      position: Math.max(0, ...steps.map((s) => s.position)) + 1,
    });
    setDraft('');
    setAdding(false);
    load();
  };

  const counts = useMemo(() => {
    const m = new Map<Owner, number>();
    steps.forEach((s) => m.set(s.owner, (m.get(s.owner) ?? 0) + 1));
    return m;
  }, [steps]);

  const shown = filter === 'all' ? steps : steps.filter((s) => s.owner === filter);
  const done = steps.filter((s) => s.status === 'done').length;
  const unowned = counts.get('unassigned') ?? 0;

  if (!loaded || (steps.length === 0 && jobs.length === 0)) return null;

  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <SectionLabel>The plan ({done} of {steps.length} done)</SectionLabel>
        <Button variant="ghost" onClick={() => setAdding((v) => !v)}>
          {adding ? 'Cancel' : 'Add a step'}
        </Button>
      </div>

      {/* Named before the list, because it is the finding, not a filter. */}
      {unowned > 0 && (
        <div
          style={{
            fontSize: 12.5, color: C.amber, marginBottom: 8,
            padding: '7px 11px', borderRadius: 7,
            background: C.amberSoft, border: `1px solid ${C.amber}44`,
          }}
        >
          {unowned} step{unowned === 1 ? '' : 's'} nobody owns. Until these are split between you and{' '}
          {clientName}, none of them are anybody&apos;s problem.
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
        {(['all', ...OWNERS.map((o) => o.id)] as const).map((k) => {
          const n = k === 'all' ? steps.length : counts.get(k as Owner) ?? 0;
          if (k !== 'all' && n === 0) return null;
          const on = filter === k;
          return (
            <button
              key={k}
              onClick={() => setFilter(k as Owner | 'all')}
              style={{
                padding: '5px 10px', borderRadius: 999, fontSize: 12.5, cursor: 'pointer',
                fontFamily: 'inherit',
                border: `1px solid ${on ? C.accent : C.border}`,
                background: on ? C.accentSoft : 'transparent',
                color: on ? C.accent : C.dim,
              }}
            >
              {k === 'all' ? 'Every step' : OWNERS.find((o) => o.id === k)?.label} ({n})
            </button>
          );
        })}
      </div>

      {adding && (
        <Card style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
              placeholder="What has to happen"
              style={{ ...inputStyle, flex: '1 1 260px' }}
            />
            <Button onClick={add} disabled={!draft.trim()}>Add</Button>
          </div>
        </Card>
      )}

      <Card>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {shown.map((s, i) => {
            const isDone = s.status === 'done';
            return (
              <div
                key={s.id}
                style={{
                  display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
                  padding: '9px 0',
                  borderTop: i === 0 ? 'none' : `1px solid ${C.border}`,
                  opacity: isDone ? 0.55 : 1,
                }}
              >
                <span
                  style={{
                    fontSize: 11.5, color: C.faint, width: 20, flexShrink: 0,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {s.position}
                </span>

                <span
                  style={{
                    fontSize: 13.5, color: C.text, flex: 1, minWidth: 180,
                    textDecoration: isDone ? 'line-through' : undefined,
                  }}
                >
                  {s.name}
                </span>

                {/* Ownership first and cheapest to change: it is the thing
                    actually being decided when you read this list. */}
                <select
                  value={s.owner}
                  onChange={(e) => set(s.id, { owner: e.target.value as Owner })}
                  style={{
                    background: s.owner === 'unassigned' ? C.amberSoft : C.panelAlt,
                    color: s.owner === 'unassigned' ? C.amber : C.dim,
                    border: `1px solid ${s.owner === 'unassigned' ? C.amber + '44' : C.border}`,
                    borderRadius: 6, padding: '3px 6px', fontSize: 12,
                    fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0,
                  }}
                >
                  {OWNERS.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>

                <select
                  value={s.status}
                  onChange={(e) => set(s.id, { status: e.target.value as Status })}
                  style={{
                    background: C.panelAlt, color: C.dim,
                    border: `1px solid ${C.border}`,
                    borderRadius: 6, padding: '3px 6px', fontSize: 12,
                    fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0,
                  }}
                >
                  {STATUSES.map((st) => (
                    <option key={st.id} value={st.id}>{st.label}</option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
