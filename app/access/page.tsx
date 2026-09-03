'use client';

/**
 * Every client, every module, one grid.
 *
 * This existed already, as a button called "What they can reach" inside one
 * client's Work tab, and then as a tab on one client's record. Both were
 * technically findable and neither was findable, because the question is never
 * "what does this one client get". It is "who is on what", and that question
 * cannot be answered by a screen that only shows one row of the answer.
 *
 * So: clients down, modules across, state in the cell. You can see in one look
 * that nobody is paying for Traffic, that two clients are waiting on a build,
 * and that Mammoth has things switched on that Colette does not.
 *
 * WHY THE STATES ARE WHAT THEY ARE
 *
 * Sold and building are commercial, not technical. They are the difference
 * between a module a client has agreed to pay for and one they can actually
 * open, and without them the only way to record a sale is to switch the thing
 * on early and hand somebody an empty screen they just bought.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { useOrg } from '@/lib/spine/org';
import {
  MODULE_LABEL,
  MODULE_STATES,
  moduleState,
  modulesFor,
  type ModuleId,
  type ModuleState,
} from '@/lib/spine/modules';
import { C, Card, Empty, Page, SectionLabel } from '@/components/spine/ui';

interface Row {
  id: string;
  name: string;
  plan: string | null;
  modules: Record<string, unknown> | null;
  workspace_id: string | null;
}

/** Cycle order, matching the client record so one mental model covers both. */
const ORDER = MODULE_STATES.map((m) => m.id);

const COLOR: Record<ModuleState, { dot: string; bg: string; label: string }> = {
  plan:     { dot: C.borderStrong, bg: 'transparent', label: '' },
  sold:     { dot: C.amber, bg: C.amberSoft, label: 'sold' },
  building: { dot: C.amber, bg: C.amberSoft, label: 'build' },
  live:     { dot: C.green, bg: C.greenSoft, label: 'live' },
  off:      { dot: C.red, bg: C.redSoft, label: 'off' },
};

export default function AccessPage() {
  const router = useRouter();
  const { org } = useOrg();
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const res = await supabase
      .from('customers')
      .select('id, name, plan, modules, workspace_id')
      .order('name');
    if (!res.error) setRows((res.data ?? []) as Row[]);
    setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  /**
   * Only the modules worth deciding about.
   *
   * Every module the platform has would be thirty columns, most of which no
   * client will ever be offered. This shows what this kind of business can
   * actually sell, which is what the org's own plan already computes.
   */
  const columns = useMemo(() => {
    if (!org) return [] as ModuleId[];
    const allowed = Array.from(modulesFor(org));
    const hide: ModuleId[] = ['business', 'security', 'team', 'records'] as ModuleId[];
    return allowed.filter((m) => !hide.includes(m));
  }, [org]);

  const cycle = async (row: Row, key: ModuleId) => {
    const mods = { ...(row.modules ?? {}) };
    const next = ORDER[(ORDER.indexOf(moduleState(mods[key])) + 1) % ORDER.length];
    if (next === 'plan') delete mods[key];
    else mods[key] = next;

    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, modules: mods } : r)));
    await supabase.from('customers').update({ modules: mods }).eq('id', row.id);
    // A client with a login keeps its own copy, or the switch is decorative.
    if (row.workspace_id) await supabase.from('orgs').update({ modules: mods }).eq('id', row.workspace_id);
  };

  const owed = useMemo(() => {
    let n = 0;
    rows.forEach((r) =>
      Object.values(r.modules ?? {}).forEach((v) => {
        const st = moduleState(v);
        if (st === 'sold' || st === 'building') n += 1;
      })
    );
    return n;
  }, [rows]);

  return (
    <Page
      title="Access"
      subtitle="Who is on what. Click a cell to move it along."
      back={{ label: 'Clients', href: '/customers' }}
    >
      {!loaded ? (
        <Empty>Loading…</Empty>
      ) : rows.length === 0 ? (
        <Card><Empty>No clients yet.</Empty></Card>
      ) : (
        <>
          {owed > 0 && (
            <div
              style={{
                fontSize: 12.5, color: C.amber, marginBottom: 12,
                padding: '8px 12px', borderRadius: 7,
                background: C.amberSoft, border: `1px solid ${C.amber}44`,
              }}
            >
              {owed} module{owed === 1 ? '' : 's'} sold and not live yet. Amber is money taken and
              not delivered.
            </div>
          )}

          {/* Scrolls sideways on its own so the page never does. */}
          <Card style={{ overflowX: 'auto' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `minmax(150px, 1.4fr) repeat(${columns.length}, minmax(74px, 1fr))`,
                gap: 1,
                minWidth: 150 + columns.length * 74,
              }}
            >
              <div />
              {columns.map((m) => (
                <div
                  key={m}
                  style={{
                    fontSize: 10.5, color: C.faint, textAlign: 'center',
                    paddingBottom: 7, lineHeight: 1.25,
                  }}
                >
                  {MODULE_LABEL[m]}
                </div>
              ))}

              {rows.map((r) => (
                <div key={r.id} style={{ display: 'contents' }}>
                  <div
                    onClick={() => router.push(`/customers/${r.id}`)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      fontSize: 13.5, color: C.text, cursor: 'pointer',
                      padding: '7px 0', borderTop: `1px solid ${C.border}`,
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.name}
                    </span>
                    <span style={{ fontSize: 10.5, color: C.faint, flexShrink: 0 }}>{r.plan}</span>
                  </div>

                  {columns.map((m) => {
                    const st = moduleState((r.modules ?? {})[m]);
                    const c = COLOR[st];
                    return (
                      <button
                        key={m}
                        onClick={() => cycle(r, m)}
                        title={`${r.name} · ${MODULE_LABEL[m]} · ${MODULE_STATES.find((x) => x.id === st)?.label}`}
                        style={{
                          borderTop: `1px solid ${C.border}`,
                          borderLeft: 'none', borderRight: 'none', borderBottom: 'none',
                          background: c.bg, cursor: 'pointer', fontFamily: 'inherit',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          gap: 5, padding: '7px 4px', fontSize: 10.5, color: c.dot,
                        }}
                      >
                        <span
                          style={{
                            width: 6, height: 6, borderRadius: '50%',
                            background: c.dot, flexShrink: 0,
                          }}
                        />
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </Card>

          <div style={{ marginTop: 14 }}>
            <SectionLabel>What the colors mean</SectionLabel>
            <Card>
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                {MODULE_STATES.map((m) => (
                  <div key={m.id} style={{ display: 'flex', gap: 7, alignItems: 'baseline' }}>
                    <span
                      style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: COLOR[m.id].dot, flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: 12.5, color: C.text }}>{m.label}</span>
                    <span style={{ fontSize: 12, color: C.faint }}>{m.note}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}
    </Page>
  );
}
