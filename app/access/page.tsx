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
import { useOrg, type Vocab } from '@/lib/spine/org';
import {
  moduleState,
  modulesOffered,
  type ModuleId,
  type ModuleState,
} from '@/lib/spine/modules';
import { ModuleSwitchboard } from '@/components/spine/ModuleSwitchboard';
import { Avatar, C, Card, Empty, Page, RowsLoading, SectionLabel, Switch, clientTabs } from '@/components/spine/ui';
import { brandAssetUrl, orgNow} from '@/lib/spine/db';
import { READ_FAILED, human } from '@/lib/spine/errors';
import { save as saveOrFail } from '@/lib/spine/save';

interface Row {
  id: string;
  name: string;
  plan: string | null;
  modules: Record<string, unknown> | null;
  workspace_id: string | null;
  logo?: string | null;
  /*
    The client's OWN kind, which decides what they should be offered.

    This screen filtered by the studio's kind and plan, because `org` here is
    the studio. An agency offering a roofer its own module list is how
    Harbor Light came to have Pitch Deck and Brand Framework on the shelf.
  */
  kind: string | null;
}


/*
  What each module is, in one line, in this workspace's own words.

  A studio calls them Clients and a rep calls them Principals, and this list
  is read by both.
*/
const whatEach = (vocab: Vocab): Partial<Record<ModuleId, string>> => ({
  jobs: `Their own ${vocab.jobPlural.toLowerCase()} and stages`,
  customers: `Their ${vocab.customer.toLowerCase()} list`,
  people: 'Their contacts',
  billing: 'Send and track invoices',
  proposals: `Send ${vocab.estimate.toLowerCase()}s`,
  pitches: 'Send a pitch',
  pl: 'What the month made',
  expenses: 'Overheads',
  receipts: 'File receipts against work',
  notes: 'Capture notes',
  reviews: 'Ask finished work for a Google review',
  seo: 'The search checklist',
  traffic: 'Who arrived at their site',
  targets: 'Companies they want',
  catalog: `A product list on each of their ${vocab.customerPlural.toLowerCase()}, priced`,
  market: `Their reference library, shared across every ${vocab.customer.toLowerCase()}`,
  website: 'Ask us for a site change',
  client_requests: 'Their requests, for you to triage',
  brand_kit: 'Their logos, colors and type',
  brands: 'The ten module framework',
  stories: 'Their case studies',
  ask: 'Ask a question of their own numbers',
  pricing: 'Their price list',
  account: 'What they owe you',
});

export default function AccessPage() {
  const router = useRouter();
  const { org, vocab } = useOrg();
  const [rows, setRows] = useState<Row[]>([]);
  const [pick, setPick] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    /**
     * The plan lives on customers, not on the summary view.
     *
     * Asking the view for a column it does not have fails the whole select,
     * and an empty result is indistinguishable from having no clients, so the
     * screen read "No clients yet" to somebody with three. Hence the error
     * below: a query that breaks now says it broke.
     */
    const [sum, full] = await Promise.all([
      supabase.from('customer_summary').select('customer_id, name, logo_path').eq('org_id', await orgNow()).order('name'),
      supabase.from('customers').select('id, plan, modules, workspace_id'),
    ]);
    if (sum.error || full.error) {
      setError(human((sum.error ?? full.error)?.message ?? `Could not read your ${vocab.customerPlural.toLowerCase()}.`, READ_FAILED));
      setLoaded(true);
      return;
    }
    const mods = new Map(
      ((full.data ?? []) as Array<{ id: string; plan: string | null; modules: Record<string, unknown> | null; workspace_id: string | null }>)
        .map((c) => [c.id, c])
    );

    /*
      The workspace is the source of truth, not the customer row.

      `customers.modules` is the studio's note about what was sold.
      `orgs.modules` is what `modulesFor` reads to decide what actually
      renders, so it is what the client can open. The two had drifted apart
      on six of seven clients here - Global Seafood Partners had four modules
      stated in exact opposition - and this screen was reading the one that
      changes nothing. A client with no workspace yet has only the customer
      row, and that is still the right answer for them.
    */
    const wsIds = Array.from(new Set(
      Array.from(mods.values()).map((c) => c.workspace_id).filter(Boolean) as string[]
    ));
    const ws = wsIds.length
      ? await supabase.from('orgs').select('id, kind, plan, modules').in('id', wsIds)
      : { data: [], error: null };
    const byWs = new Map(
      ((ws.data ?? []) as Array<{ id: string; kind: string | null; plan: string | null; modules: Record<string, unknown> | null }>)
        .map((o) => [o.id, o])
    );

    const merged: Row[] = ((sum.data ?? []) as Array<{ customer_id: string; name: string; logo_path: string | null }>)
      .map((b) => {
        const c = mods.get(b.customer_id);
        const w = c?.workspace_id ? byWs.get(c.workspace_id) : null;
        return {
          id: b.customer_id,
          name: b.name,
          plan: w?.plan ?? c?.plan ?? null,
          logo: b.logo_path,
          modules: (w ? w.modules : c?.modules) ?? {},
          workspace_id: c?.workspace_id ?? null,
          kind: w?.kind ?? null,
        };
      });
    setRows(merged);
    setPick((p) => p ?? merged[0]?.id ?? null);
    setLoaded(true);
  }, [vocab.customerPlural]);

  useEffect(() => { load(); }, [load]);

  const client = rows.find((r) => r.id === pick) ?? null;

  /*
    What to offer THIS client, from their own kind and plan.

    Was `modulesFor(org)` - the studio's own live set - which answered a
    different question twice over: whose modules, and which of them. Same
    `modulesOffered` the Plans and access screen and the view-mode panel now
    take. Falls back to the studio's kind for a client with no workspace, who
    has no kind of their own to read.
  */
  const modules = useMemo(() => {
    if (!org) return [] as ModuleId[];
    const hide: ModuleId[] = ['business', 'security', 'team', 'records'] as ModuleId[];
    const kind = (client?.kind ?? org.kind) as Parameters<typeof modulesOffered>[0];
    return modulesOffered(kind, client?.plan ?? org.plan).filter((m) => !hide.includes(m));
  }, [org, client?.kind, client?.plan]);

  const write = async (row: Row, key: ModuleId, next: ModuleState | null) => {
    const mods = { ...(row.modules ?? {}) };
    if (next === null) delete mods[key];
    else mods[key] = next;
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, modules: mods } : r)));
    /* The workspace is what gates the client, so it is written first and its
       failure is the one that matters. The customer row is the studio's copy
       of the same fact and is kept in step. */
    if (row.workspace_id) await saveOrFail(supabase.from('orgs').update({ modules: mods }).eq('id', row.workspace_id));
    await saveOrFail(supabase.from('customers').update({ modules: mods }).eq('id', row.id));
  };

  const owed = useMemo(
    () => rows.reduce((n, r) =>
      n + Object.values(r.modules ?? {}).filter((v) => ['sold', 'building'].includes(moduleState(v))).length, 0),
    [rows]
  );

  return (
    <Page title="Access" subtitle={`What each ${vocab.customer.toLowerCase()} can open.`} tabs={clientTabs(org?.kind)}>
      {!loaded ? (
        <RowsLoading rows={5} />
      ) : error ? (
        <Card>
          <div style={{ fontSize: 13.5, color: C.red, lineHeight: 1.6 }}>
            Could not read your clients, so this is not an empty account. {error}
          </div>
        </Card>
      ) : rows.length === 0 ? (
        <Card><Empty>No {vocab.customerPlural.toLowerCase()} yet. Add one and you can choose what they see.</Empty></Card>
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
                    padding: '5px 12px 5px 6px', borderRadius: 999,
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
                {/* No plans exist yet, so printing "core plan" beside every client
                    stated a commercial fact that is not true. */}
                <SectionLabel>{client.name}</SectionLabel>
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

              <ModuleSwitchboard
                modules={modules}
                state={(client.modules ?? {}) as Record<string, unknown>}
                what={whatEach(vocab)}
                showSold
                onChange={(m, next) => write(client, m, next)}
                onSell={(m, selling) => write(client, m, selling ? null : 'sold')}
              />

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
