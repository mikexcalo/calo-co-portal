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
import { MODULE_LABEL, type ModuleId } from '@/lib/spine/modules';
import { C, Card, Empty, Pill, SectionLabel } from '@/components/spine/ui';

interface Workspace {
  id: string;
  name: string;
  kind: string;
  plan: 'core' | 'grow' | 'agency';
  modules: Record<string, boolean> | null;
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
    const res = await supabase.from('orgs').update({ plan }).eq('id', w.id);
    setBusy(null);
    if (!res.error) setRows((r) => r.map((x) => (x.id === w.id ? { ...x, plan } : x)));
  };

  /**
   * Three states, not two.
   *
   * Following the plan is different from being switched on, and the difference
   * matters the moment somebody upgrades: a module left explicitly off stays
   * off through the upgrade, which is almost never what anybody meant.
   */
  const cycle = async (w: Workspace, key: string) => {
    const mods = { ...(w.modules ?? {}) };
    if (!(key in mods)) mods[key] = true;
    else if (mods[key] === true) mods[key] = false;
    else delete mods[key];

    setBusy(w.id);
    const res = await supabase.from('orgs').update({ modules: mods }).eq('id', w.id);
    setBusy(null);
    if (!res.error) setRows((r) => r.map((x) => (x.id === w.id ? { ...x, modules: mods } : x)));
  };

  const state = (w: Workspace, key: string) => {
    const v = (w.modules ?? {})[key];
    return v === true ? 'on' : v === false ? 'off' : 'plan';
  };

  if (loading) return <Card><Empty>Loading…</Empty></Card>;

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
                      borderRadius: 8, padding: '7px 14px', fontSize: 13.5,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            <SectionLabel>Modules</SectionLabel>
            <Grid
              items={(Object.keys(MODULE_LABEL) as ModuleId[]).map((m) => ({
                id: m, label: MODULE_LABEL[m], note: '',
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
  state: (key: string) => 'on' | 'off' | 'plan';
  onClick: (key: string) => void;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(178px, 1fr))', gap: 5 }}>
      {items.map((i) => {
        const s = state(i.id);
        const color = s === 'on' ? C.green : s === 'off' ? C.red : C.faint;
        const bg = s === 'on' ? C.greenSoft : s === 'off' ? C.redSoft : 'transparent';
        return (
          <button
            key={i.id}
            onClick={() => onClick(i.id)}
            title={i.note || undefined}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
              border: `1px solid ${C.border}`, background: bg, borderRadius: 7,
              padding: '8px 10px', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: C.text, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {i.label}
            </span>
            <span style={{ fontSize: 10.5, color: C.faint }}>
              {s === 'plan' ? 'plan' : s}
            </span>
          </button>
        );
      })}
    </div>
  );
}
