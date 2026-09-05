'use client';

/**
 * What you see, and what you have switched off.
 *
 * Access answers that question for a client. Nobody could answer it about
 * their own workspace, so everything the product can do was permanently on:
 * a sidebar carrying rows for pitches you are not writing, a price book you
 * have not filled in, receipts you do not file. A tool that shows you every
 * capability it has is a tool that makes you feel behind on all of them.
 *
 * The same switchboard as Access, pointed at yourself. Nothing is deleted and
 * nothing is lost; a row you switch off stops appearing in the sidebar and
 * comes straight back when you want it.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import supabase from '@/lib/supabase';
import { useOrg } from '@/lib/spine/org';
import { modulesFor, type ModuleId, type ModuleState } from '@/lib/spine/modules';
import { ModuleSwitchboard } from '@/components/spine/ModuleSwitchboard';
import { C, Card, Empty, Page, SETUP_TABS } from '@/components/spine/ui';

/** What each one is, to you rather than to a client. */
const WHAT: Partial<Record<ModuleId, string>> = {
  customers: 'Everyone you work with',
  people: 'The address book, clients or not',
  jobs: 'Engagements, from first call to final payment',
  targets: 'Everyone you want, before they are anybody you have',
  market: 'Reference that stays true across every client',
  billing: 'Send and chase invoices',
  proposals: 'Quote work before you do it',
  pitches: 'Send a link instead of a deck',
  pl: 'What the month made, with overheads and receipts inside it',
  expenses: 'Standing costs',
  receipts: 'Costs you bill back',
  pricing: 'What you charge, so estimates start somewhere',
  seo: 'How you are found online',
  traffic: 'Who arrived at your site',
  reviews: 'Ask finished work for a review, automatically',
  brand_kit: 'Your logos, colors, type and voice',
  brands: 'The ten module framework you run clients through',
  stories: 'Case studies, written once and reused',
  website: 'Your own site',
  client_requests: 'What clients have asked you for',
  catalog: 'A product list on a client record, priced',
  notes: 'The capture button in the top bar',
  ask: 'Ask a question of your own numbers',
  account: 'What you owe somebody else',
};

export default function WhatYouSeePage() {
  const { org, refresh } = useOrg();
  const [state, setState] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!org) return;
    const res = await supabase.from('orgs').select('modules').eq('id', org.id).maybeSingle();
    if (res.error) setError(res.error.message);
    else setState(((res.data?.modules ?? {}) as Record<string, unknown>));
    setLoaded(true);
  }, [org]);

  useEffect(() => { load(); }, [load]);

  /**
   * Everything the business could have, not everything it currently has.
   *
   * Reading the live list would hide anything already switched off, so the one
   * row you came here to turn back on would be the one row missing.
   */
  const modules = useMemo(() => {
    if (!org) return [] as ModuleId[];
    const all = new Set<ModuleId>([
      ...Array.from(modulesFor({ ...org, modules: {} } as typeof org)),
      ...(Object.keys(state) as ModuleId[]),
    ]);
    const hide: ModuleId[] = ['business', 'security', 'team', 'records'];
    return Array.from(all).filter((m) => !hide.includes(m));
  }, [org, state]);

  const write = async (id: ModuleId, next: ModuleState) => {
    if (!org) return;
    const mods = { ...state, [id]: next };
    setState(mods);
    const res = await supabase.from('orgs').update({ modules: mods }).eq('id', org.id);
    if (res.error) { setError(res.error.message); load(); return; }
    // The sidebar reads the org, so it has to be told the org changed.
    await refresh();
  };

  const off = Object.values(state).filter((v) => v === 'off' || v === false).length;

  return (
    <Page
      title="What you see"
      subtitle="Switch off anything you are not using yet. Nothing is deleted, and it comes back the moment you want it."
      tabs={SETUP_TABS}
    >
      {error && (
        <Card style={{ borderColor: C.red, marginBottom: 14 }}>
          <div style={{ color: C.red, fontSize: 13.5 }}>{error}</div>
        </Card>
      )}

      {!loaded || !org ? (
        <Empty>Loading…</Empty>
      ) : (
        <>
          {off > 0 && (
            <div style={{ fontSize: 12.5, color: C.faint, marginBottom: 12 }}>
              {off} switched off. They are still here, just not in your way.
            </div>
          )}
          <ModuleSwitchboard
            modules={modules}
            state={state}
            what={WHAT}
            onChange={write}
          />
        </>
      )}
    </Page>
  );
}
