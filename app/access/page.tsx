'use client';

/**
 * What each client can reach, as switches.
 *
 * This was a matrix: clients down, fourteen modules across, and a grey dot in
 * every cell that cycled through five states when clicked. Three problems, all
 * fatal. A dot does not look pressable and does not show which way it points.
 * Fourteen columns ran off the side of the screen, so half the modules were
 * only reachable by scrolling sideways inside a card. And five states behind
 * one click means you cannot reach the one you want without passing through
 * the ones you do not.
 *
 * One client at a time, a row per module, a switch on the right. A switch
 * answers the only question that matters to them: can they open it.
 *
 * WHY SOLD IS NOT ON THE SWITCH
 *
 * It is not access, it is money. A module can be paid for and not built, which
 * is a fact about you rather than about what they can see, so it sits beside
 * the switch and leaves the switch binary.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { useOrg } from '@/lib/spine/org';
import {
  MODULE_LABEL,
  moduleState,
  modulesFor,
  type ModuleId,
  type ModuleState,
} from '@/lib/spine/modules';
import { Avatar, CLIENT_TABS, C, Card, Empty, Page, SectionLabel, Switch } from '@/components/spine/ui';
import { brandAssetUrl } from '@/lib/spine/db';

interface Row {
  id: string;
  name: string;
  plan: string | null;
  modules: Record<string, unknown> | null;
  workspace_id: string | null;
  logo?: string | null;
}


/** What each module is, in one line, so the switch is not a guess. */
const WHAT: Partial<Record<ModuleId, string>> = {
  jobs: 'Their own projects and stages',
  customers: 'Their client list',
  people: 'Their contacts',
  billing: 'Send and track invoices',
  proposals: 'Quote work',
  pitches: 'Send a pitch',
  pl: 'What the month made',
  expenses: 'Overheads',
  receipts: 'File receipts against work',
  notes: 'Capture notes',
  reviews: 'Ask finished work for a Google review',
  seo: 'The search checklist',
  traffic: 'Who arrived at their site',
  targets: 'Companies they want',
  website: 'Ask us for a site change',
  client_requests: 'Their requests, for you to triage',
  brand_kit: 'Their logos, colors and type',
  brands: 'The ten module framework',
  stories: 'Their case studies',
  ask: 'Ask a question of their own numbers',
  pricing: 'Their price list',
  account: 'What they owe you',
};

export default function AccessPage() {
  const router = useRouter();
  const { org } = useOrg();
  const [rows, setRows] = useState<Row[]>([]);
  const [pick, setPick] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const [sum, full] = await Promise.all([
      supabase.from('customer_summary').select('customer_id, name, plan, logo_path').order('name'),
      supabase.from('customers').select('id, modules, workspace_id'),
    ]);
    const mods = new Map(
      ((full.data ?? []) as Array<{ id: string; modules: Record<string, unknown> | null; workspace_id: string | null }>)
        .map((c) => [c.id, c])
    );
    const merged: Row[] = ((sum.data ?? []) as Array<{ customer_id: string; name: string; plan: string | null; logo_path: string | null }>)
      .map((b) => ({
        id: b.customer_id,
        name: b.name,
        plan: b.plan,
        logo: b.logo_path,
        modules: mods.get(b.customer_id)?.modules ?? {},
        workspace_id: mods.get(b.customer_id)?.workspace_id ?? null,
      }));
    setRows(merged);
    setPick((p) => p ?? merged[0]?.id ?? null);
    setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  const client = rows.find((r) => r.id === pick) ?? null;

  const modules = useMemo(() => {
    if (!org) return [] as ModuleId[];
    const hide: ModuleId[] = ['business', 'security', 'team', 'records'] as ModuleId[];
    return Array.from(modulesFor(org)).filter((m) => !hide.includes(m));
  }, [org]);

  const write = async (row: Row, key: ModuleId, next: ModuleState | null) => {
    const mods = { ...(row.modules ?? {}) };
    if (next === null) delete mods[key];
    else mods[key] = next;
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, modules: mods } : r)));
    await supabase.from('customers').update({ modules: mods }).eq('id', row.id);
    // A client with a login keeps its own copy, or the switch is decorative.
    if (row.workspace_id) await supabase.from('orgs').update({ modules: mods }).eq('id', row.workspace_id);
  };

  const owed = useMemo(
    () => rows.reduce((n, r) =>
      n + Object.values(r.modules ?? {}).filter((v) => ['sold', 'building'].includes(moduleState(v))).length, 0),
    [rows]
  );

  return (
    <Page title="Access" subtitle="What each client can open." tabs={CLIENT_TABS}>
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
              {owed} module{owed === 1 ? '' : 's'} sold and not live yet, across all clients.
            </div>
          )}

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {rows.map((r) => {
              const on = r.id === pick;
              return (
                <button
                  key={r.id}
                  onClick={() => setPick(r.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 12px 6px 7px', borderRadius: 8,
                    border: `1px solid ${on ? C.accent : C.border}`,
                    background: on ? C.accentSoft : 'transparent',
                    color: on ? C.text : C.dim,
                    fontSize: 13.5, fontWeight: on ? 500 : 400,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <Avatar src={brandAssetUrl(r.logo)} name={r.name} size={20} shape="company" />
                  {r.name}
                </button>
              );
            })}
          </div>

          {client && (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                <SectionLabel>{client.name} · {client.plan} plan</SectionLabel>
                <button
                  onClick={() => router.push(`/customers/${client.id}`)}
                  style={{
                    background: 'transparent', border: 'none', padding: 0,
                    color: C.accent, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Open the client →
                </button>
              </div>

              <Card>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {modules.map((m, i) => {
                    const st = moduleState((client.modules ?? {})[m]);
                    const live = st === 'live';
                    const selling = st === 'sold' || st === 'building';
                    return (
                      <div
                        key={m}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '10px 0', flexWrap: 'wrap',
                          borderTop: i === 0 ? 'none' : `1px solid ${C.border}`,
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 14, color: C.text }}>{MODULE_LABEL[m]}</div>
                          <div style={{ fontSize: 12.5, color: C.faint }}>
                            {WHAT[m] ?? ''}{st === 'plan' ? ' · follows their plan' : ''}
                          </div>
                        </div>

                        {!live && (
                          <button
                            onClick={() => write(client, m, selling ? null : 'sold')}
                            style={{
                              fontSize: 11.5, padding: '3px 9px', borderRadius: 6,
                              cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
                              border: `1px solid ${selling ? C.amber : C.border}`,
                              background: selling ? C.amberSoft : 'transparent',
                              color: selling ? C.amber : C.faint,
                            }}
                          >
                            {selling ? 'sold, not built' : 'mark sold'}
                          </button>
                        )}

                        <Switch on={live} onChange={(next) => write(client, m, next ? 'live' : 'off')} />
                      </div>
                    );
                  })}
                </div>
              </Card>

              <div style={{ fontSize: 12.5, color: C.faint, marginTop: 10, lineHeight: 1.6, maxWidth: '64ch' }}>
                On means they can open it. Off means they cannot, and stays off through a plan
                upgrade. Anything untouched follows whatever their plan includes.
              </div>
            </>
          )}
        </>
      )}
    </Page>
  );
}
