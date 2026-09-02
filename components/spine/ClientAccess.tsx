'use client';

/**
 * Does this client log in, and what can they reach.
 *
 * The confusion this exists to end: a client and a workspace are different
 * things, and nothing on screen ever said so.
 *
 *   A client is somebody you do work for. They have an engagement, a brand, a
 *   target list, notes. They do not log in.
 *
 *   A workspace is a business that runs itself in here. Its own jobs, its own
 *   invoices, its own customers, its own login.
 *
 * Mammoth is both. John is only the first, which is the whole answer to why he
 * is "not set up": nobody decided he should run his own operations, and there
 * was never a button that would do it.
 *
 * Modules are chosen here whether or not a login exists, because the decision
 * "they get Search" is made about the client, usually before they are paying.
 * Creating the workspace later copies them across, so setting something up
 * before somebody pays is a note you write once rather than work you redo at
 * handover.
 */

import { useCallback, useEffect, useState } from 'react';
import supabase from '@/lib/supabase';
import { MODULE_LABEL, type ModuleId } from '@/lib/spine/modules';
import { Button, C, Card, Pill, SectionLabel } from './ui';

interface Access {
  workspace_id: string | null;
  plan: 'core' | 'grow' | 'agency';
  modules: Record<string, boolean> | null;
  name: string;
  kind_hint: string | null;
}

const PLANS: Array<{ id: Access['plan']; label: string; note: string }> = [
  { id: 'core', label: 'Core', note: 'Record the work, get paid, know the month' },
  { id: 'grow', label: 'Grow', note: 'Core plus the machinery that finds work' },
];

/** Capabilities with no sidebar row of their own. */
const FEATURES = [
  { id: 'optional_lines', label: 'Optional line items' },
  { id: 'intake_form', label: 'Enquiry form' },
  { id: 'follow_ups', label: 'Follow-ups' },
  { id: 'ask', label: 'Ask' },
];

export function ClientAccess({ customerId }: { customerId: string }) {
  const [row, setRow] = useState<Access | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await supabase
      .from('customers')
      .select('name, workspace_id, plan, modules')
      .eq('id', customerId)
      .maybeSingle();
    if (res.data) setRow({ ...(res.data as Access), kind_hint: null });
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  if (!row) return null;

  const setPlan = async (plan: Access['plan']) => {
    setBusy(true);
    await supabase.from('customers').update({ plan }).eq('id', customerId);
    // A workspace that already exists follows the client's plan, so the two
    // cannot drift into disagreeing about what somebody paid for.
    if (row.workspace_id) await supabase.from('orgs').update({ plan }).eq('id', row.workspace_id);
    setBusy(false);
    setRow({ ...row, plan });
  };

  /**
   * Three states, not two.
   *
   * Following the plan is different from being switched on, and the difference
   * shows the moment somebody upgrades: a module left explicitly off stays off
   * through the upgrade, which is almost never what anybody meant.
   */
  const cycle = async (key: string) => {
    const mods = { ...(row.modules ?? {}) };
    if (!(key in mods)) mods[key] = true;
    else if (mods[key] === true) mods[key] = false;
    else delete mods[key];

    setBusy(true);
    await supabase.from('customers').update({ modules: mods }).eq('id', customerId);
    if (row.workspace_id) await supabase.from('orgs').update({ modules: mods }).eq('id', row.workspace_id);
    setBusy(false);
    setRow({ ...row, modules: mods });
  };

  const state = (key: string) => {
    const v = (row.modules ?? {})[key];
    return v === true ? 'on' : v === false ? 'off' : 'plan';
  };

  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <SectionLabel>Access</SectionLabel>
        <Button variant="ghost" onClick={() => setOpen((v) => !v)}>
          {open ? 'Done' : 'What they can reach'}
        </Button>
      </div>

      <Card>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {row.workspace_id ? (
            <>
              <Pill tone="green">has a login</Pill>
              <span style={{ fontSize: 13.5, color: C.dim, flex: 1, minWidth: 200 }}>
                {row.name} runs their own jobs, invoices and customers in here.
              </span>
            </>
          ) : (
            <>
              <Pill>no login</Pill>
              <span style={{ fontSize: 13.5, color: C.dim, flex: 1, minWidth: 200 }}>
                A client you do work for. Everything about them lives on this record, and nothing
                needs a login until they want to run their own operations.
              </span>
            </>
          )}
          <span style={{ fontSize: 12.5, color: C.faint }}>{row.plan}</span>
        </div>

        {open && (
          <div style={{ marginTop: 18 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
              {PLANS.map((p) => {
                const on = row.plan === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setPlan(p.id)}
                    title={p.note}
                    disabled={busy}
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

            <Grid
              items={(Object.keys(MODULE_LABEL) as ModuleId[]).map((m) => ({ id: m, label: MODULE_LABEL[m] }))}
              state={state}
              onClick={cycle}
            />

            <div style={{ marginTop: 14 }}>
              <Grid items={FEATURES} state={state} onClick={cycle} />
            </div>

            <p style={{ fontSize: 12.5, color: C.faint, marginTop: 14, lineHeight: 1.65, maxWidth: 620 }}>
              Click to cycle: following the plan, forced on, forced off. Chosen here whether or not
              they can log in, so setting something up before somebody pays is written down once
              rather than redone at handover.
            </p>
          </div>
        )}

        {error && <div style={{ fontSize: 13, color: C.red, marginTop: 10 }}>{error}</div>}
      </Card>
    </div>
  );
}

function Grid({
  items, state, onClick,
}: {
  items: Array<{ id: string; label: string }>;
  state: (k: string) => 'on' | 'off' | 'plan';
  onClick: (k: string) => void;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(172px, 1fr))', gap: 5 }}>
      {items.map((i) => {
        const s = state(i.id);
        const color = s === 'on' ? C.green : s === 'off' ? C.red : C.faint;
        const bg = s === 'on' ? C.greenSoft : s === 'off' ? C.redSoft : 'transparent';
        return (
          <button
            key={i.id}
            onClick={() => onClick(i.id)}
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
            <span style={{ fontSize: 10.5, color: C.faint }}>{s === 'plan' ? 'plan' : s}</span>
          </button>
        );
      })}
    </div>
  );
}
