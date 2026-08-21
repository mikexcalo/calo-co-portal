'use client';

/**
 * Org context — which business you're currently looking at.
 *
 * One login, many businesses. `memberships` says which orgs you may access;
 * `profiles.active_org_id` says which one you're viewing right now. Switching
 * writes active_org_id, and the database re-derives everything from there —
 * so a switch can never leak data across businesses even if the client lies.
 *
 * The vocabulary changes with the org's kind. Mammoth has Jobs and Customers;
 * CALO&CO has Engagements and Clients. Same tables, same code, different
 * words — which is what makes this a template rather than one bespoke app.
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import supabase from '@/lib/supabase';
import type { Org } from './types';

export interface Vocab {
  job: string;
  jobPlural: string;
  customer: string;
  customerPlural: string;
  estimate: string;
  /** Shown on the pipeline board's first column. */
  lead: string;
}

const CONTRACTOR: Vocab = {
  job: 'Job',
  jobPlural: 'Jobs',
  customer: 'Customer',
  customerPlural: 'Customers',
  estimate: 'Estimate',
  lead: 'Lead',
};

const AGENCY: Vocab = {
  job: 'Engagement',
  jobPlural: 'Engagements',
  customer: 'Client',
  customerPlural: 'Clients',
  estimate: 'Proposal',
  lead: 'Prospect',
};

export const vocabFor = (kind: Org['kind'] | undefined): Vocab =>
  kind === 'agency' ? AGENCY : CONTRACTOR;

interface OrgContextValue {
  org: Org | null;
  orgs: Org[];
  vocab: Vocab;
  loading: boolean;
  error: string | null;
  switchOrg: (orgId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const OrgContext = createContext<OrgContextValue>({
  org: null,
  orgs: [],
  vocab: CONTRACTOR,
  loading: true,
  error: null,
  switchOrg: async () => {},
  refresh: async () => {},
});

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const [org, setOrg] = useState<Org | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        setOrg(null);
        setOrgs([]);
        return;
      }

      // RLS already limits orgs to ones you're a member of, so this is
      // exactly the switcher's list.
      const [{ data: orgRows, error: orgErr }, { data: profile, error: pErr }] =
        await Promise.all([
          supabase.from('orgs').select('*').order('name'),
          supabase.from('profiles').select('active_org_id').eq('id', auth.user.id).maybeSingle(),
        ]);

      if (orgErr) throw new Error(orgErr.message);
      if (pErr) throw new Error(pErr.message);

      const list = (orgRows ?? []) as Org[];
      setOrgs(list);
      setOrg(list.find((o) => o.id === profile?.active_org_id) ?? list[0] ?? null);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const switchOrg = useCallback(
    async (orgId: string) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) return;

      const res = await supabase
        .from('profiles')
        .update({ active_org_id: orgId })
        .eq('id', auth.user.id);
      if (res.error) {
        setError(res.error.message);
        return;
      }

      // Full reload rather than swapping state: every open page is showing
      // the other business's data and needs to re-fetch from scratch.
      window.location.reload();
    },
    []
  );

  return (
    <OrgContext.Provider
      value={{
        org,
        orgs,
        vocab: vocabFor(org?.kind),
        loading,
        error,
        switchOrg,
        refresh: load,
      }}
    >
      {children}
    </OrgContext.Provider>
  );
}

export const useOrg = () => useContext(OrgContext);
