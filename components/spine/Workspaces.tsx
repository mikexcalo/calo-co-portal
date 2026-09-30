'use client';

/**
 * The plan and module switchboard.
 *
 * This exists because of one business decision: set a module up for a client
 * while they are not paying for it, then hand it over when they are. Without a
 * screen that is a database edit, which means it happens when somebody is
 * available rather than when the client pays.
 *
 * Only workspaces you actually belong to appear here, which is not a UI choice.
 * The row level policy on orgs already limits reads to your memberships and
 * writes to the ones where you are an owner or admin, so this screen cannot
 * show or change anything the database would not have allowed anyway.
 */

import { useCallback, useEffect, useState } from 'react';
import supabase from '@/lib/supabase';
import {
  MODULE_LABEL,
  MODULE_STATES,
  moduleState,
  modulesOffered,
  type ModuleId,
  type ModuleState,
} from '@/lib/spine/modules';
import { C, Card, Empty, Pill, RowsLoading, SectionLabel } from '@/components/spine/ui';
import { save as saveOrFail } from '@/lib/spine/save';

interface Workspace {
  id: string;
  name: string;
  kind: string;
  plan: 'core' | 'grow' | 'agency';
  /*
    Five states, written as strings, the same as everywhere else.

    This was typed `Record<string, boolean>` and cycled true / false /
    absent, which is three of the five. A module the Access screen had marked
    `sold` or `building` fell through both tests and drew here as "Follows
    plan" - so the screen that exists to show what a client has bought was
    the one screen that could not show a module as bought.
  */
  modules: Record<string, unknown> | null;
}

const PLANS: Array<{ id: Workspace['plan']; label: string; note: string }> = [
  { id: 'core', label: 'Core', note: 'Record the work, get paid, know the month' },
  { id: 'grow', label: 'Grow', note: 'Everything in Core, plus going and finding work' },
  { id: 'agency', label: 'Agency', note: 'Your own workspace' },
];

/** Capabilities with no sidebar row of their own, switchable all the same. */
const FEATURES: Array<{ id: string; label: string; note: string }> = [
  { id: 'optional_lines', label: 'Optional line items', note: 'Add-ons the customer ticks on an estimate' },
  { id: 'intake_form', label: 'Enquiry form', note: 'A public link that drops leads into their clients' },
  { id: 'follow_ups', label: 'Follow-ups', note: 'Chases quiet quotes and late invoices' },
  { id: 'ask', label: 'Ask', note: 'Questions answered from their own data' },
];

export function Workspaces() {
  const [rows, setRows] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await supabase.from('orgs').select('id, name, kind, plan, modules').order('name');
    if (!res.error) setRows((res.data ?? []) as Workspace[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const setPlan = async (w: Workspace, plan: Workspace['plan']) => {
    setBusy(w.id);
    const res = await saveOrFail(supabase.from('orgs').update({ plan }).eq('id', w.id));
    setBusy(null);
    if (!res.error) setRows((r) => r.map((x) => (x.id === w.id ? { ...x, plan } : x)));
  };

  /**
   * Five states, in the order somebody sells one.
   *
   * plan -> sold -> building -> live -> off -> plan. The same ladder the
   * Access screen walks, so the two screens cannot describe one module
   * differently. `plan` is written as an absent key rather than a value,
   * because following the plan is the absence of a decision.
   */
  const cycle = async (w: Workspace, key: string) => {
    const order = MODULE_STATES.map((x) => x.id);
    const now = moduleState((w.modules ?? {})[key]);
    const next = order[(order.indexOf(now) + 1) % order.length];
    const mods = { ...(w.modules ?? {}) };
    if (next === 'plan') delete mods[key];
    else mods[key] = next;

    setBusy(w.id);
    const res = await saveOrFail(supabase.from('orgs').update({ modules: mods }).eq('id', w.id));
    setBusy(null);
    if (!res.error) setRows((r) => r.map((x) => (x.id === w.id ? { ...x, modules: mods } : x)));
  };

  const state = (w: Workspace, key: string): ModuleState =>
    moduleState((w.modules ?? {})[key]);

  if (loading) return <RowsLoading rows={4} />;

  return (
    <>
      <p style={{ fontSize: 13.5, color: C.dim, margin: '0 0 18px', maxWidth: 640, lineHeight: 1.65 }}>
        What each business is on and what they can reach. Set a module up before they pay for it,
        then hand it over.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {rows.map((w) => (
          <Card key={w.id}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 14 }}>
              <span style={{ fontSize: 16, fontWeight: 600, color: C.text }}>{w.name}</span>
              <Pill>{w.kind}</Pill>
              {busy === w.id && <span style={{ fontSize: 12, color: C.faint }}>saving…</span>}
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
              {PLANS.map((p) => {
                const on = w.plan === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setPlan(w, p.id)}
                    title={p.note}
                    style={{
                      border: `1px solid ${on ? C.accent : C.border}`,
                      background: on ? C.accentSoft : 'transparent',
                      color: on ? C.text : C.dim,
                      borderRadius: 999, padding: '7px 14px', fontSize: 13.5,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            <SectionLabel>Modules</SectionLabel>
            {/*
              What this business's kind and plan allow, not every module that
              exists. Listing all of them offered a roofer a Pitch Deck.
            */}
            <Grid
              items={modulesOffered(w.kind as Parameters<typeof modulesOffered>[0], w.plan).map((m) => ({
                id: m, label: MODULE_LABEL[m as ModuleId], note: '',
              }))}
              state={(k) => state(w, k)}
              onClick={(k) => cycle(w, k)}
            />

            <div style={{ marginTop: 16 }}>
              <SectionLabel>Features</SectionLabel>
              <Grid
                items={FEATURES}
                state={(k) => state(w, k)}
                onClick={(k) => cycle(w, k)}
              />
            </div>
          </Card>
        ))}
      </div>

      <p style={{ fontSize: 13, color: C.faint, marginTop: 18, lineHeight: 1.7, maxWidth: 620 }}>
        Click to cycle: following the plan, forced on, forced off. Following the plan is the
        useful default, because a module forced off stays off through an upgrade, which is almost
        never what anybody meant.
      </p>
    </>
  );
}

function Grid({
  items,
  state,
  onClick,
}: {
  items: Array<{ id: string; label: string; note: string }>;
  state: (key: string) => ModuleState;
  onClick: (key: string) => void;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(178px, 1fr))', gap: 5 }}>
      {items.map((i) => {
        const s = state(i.id);
        /* Live is on, off is denied, and the two commercial states in
           between are neither: amber for work that is paid for or underway. */
        const color = s === 'live' ? C.green : s === 'off' ? C.red : s === 'plan' ? C.faint : C.amber;
        const bg = s === 'live' ? C.greenSoft : s === 'off' ? C.redSoft : 'transparent';
        return (
          <button
            key={i.id}
            onClick={() => onClick(i.id)}
            title={i.note || undefined}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
              border: `1px solid ${C.border}`, background: bg, borderRadius: 999,
              padding: '8px 10px', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: C.text, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {i.label}
            </span>
            <span style={{ fontSize: 10.5, color: C.faint }}>{s}</span>
          </button>
        );
      })}
    </div>
  );
}
