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
import { MODULE_LABEL, MODULE_STATES, moduleState, type ModuleId, type ModuleState } from '@/lib/spine/modules';
import { Button, C, Card, Pill, SectionLabel } from './ui';

interface Access {
  workspace_id: string | null;
  plan: 'core' | 'grow' | 'agency';
  modules: Record<string, unknown> | null;
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
   * Five states, in the order you sell one.
   *
   * Following the plan is different from being switched on, and both are
   * different from having been paid for and not built yet. Without sold and
   * building, the only way to record "they are paying me to build this" is to
   * switch it on early, which hands them an empty screen and makes the thing
   * they just bought look broken.
   */
  const cycle = async (key: string) => {
    const mods = { ...(row.modules ?? {}) };
    const order = MODULE_STATES.map((m) => m.id);
    const next = order[(order.indexOf(moduleState(mods[key])) + 1) % order.length];

    // `plan` is the absence of a decision, so it is a deletion rather than a
    // stored value. Anything else and an upgrade cannot tell "nobody chose"
    // from "somebody chose the default".
    if (next === 'plan') delete mods[key];
    else mods[key] = next;

    setBusy(true);
    await supabase.from('customers').update({ modules: mods }).eq('id', customerId);
    if (row.workspace_id) await supabase.from('orgs').update({ modules: mods }).eq('id', row.workspace_id);
    setBusy(false);
    setRow({ ...row, modules: mods });
  };

  const state = (key: string): ModuleState => moduleState((row.modules ?? {})[key]);

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
                      borderRadius: 999, padding: '6px 14px', fontSize: 13.5,
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

            <p style={{ fontSize: 12.5, color: C.faint, marginTop: 14, lineHeight: 1.65, maxWidth: '64ch' }}>
              Click to cycle through {MODULE_STATES.map((m) => m.label.toLowerCase()).join(', ')}.
              Only live is visible to them: sold and building are what you have been paid for and
              not delivered yet, so a client never opens a screen they bought and finds it empty.
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
  state: (k: string) => ModuleState;
  onClick: (k: string) => void;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(172px, 1fr))', gap: 5 }}>
      {items.map((i) => {
        const s = state(i.id);
        /* Amber for the two commercial states, because they are money owed to
           you rather than a setting: something sold and not yet delivered is
           the one thing on this screen with a deadline attached. */
        const color =
          s === 'live' ? C.green
          : s === 'off' ? C.red
          : s === 'sold' || s === 'building' ? C.amber
          : C.faint;
        const bg =
          s === 'live' ? C.greenSoft
          : s === 'off' ? C.redSoft
          : s === 'sold' || s === 'building' ? C.amberSoft
          : 'transparent';
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
            <span style={{ fontSize: 10.5, color: s === 'plan' ? C.faint : color }}>
              {s === 'plan' ? 'plan' : s}
            </span>
          </button>
        );
      })}
    </div>
  );
}
