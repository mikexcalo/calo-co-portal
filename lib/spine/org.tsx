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

      const activeId = profile?.active_org_id ?? null;
      const matched = activeId ? list.find((o) => o.id === activeId) ?? null : null;

      if (matched) {
        setOrg(matched);
      } else if (list.length) {
        // The label and the database's scope MUST agree. Silently defaulting
        // to list[0] while the database still scopes to something else is how
        // one client's data ends up displayed under another client's name.
        // So don't guess — write the choice back, then display it.
        const fallback = list[0];
        const fix = await supabase
          .from('profiles')
          .update({ active_org_id: fallback.id })
          .eq('id', auth.user.id);

        if (fix.error) {
          setOrg(null);
          setError(
            'Could not work out which business you are viewing. Reload, and if it persists, sign out and back in.'
          );
          return;
        }
        setOrg(fallback);
      } else {
        setOrg(null);
      }

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

  /**
   * Re-check on focus. Switching business in a second tab changes the value
   * server-side, which would otherwise leave this tab showing the old name
   * over the new tab's data.
   */
  useEffect(() => {
    const recheck = () => {
      if (document.visibilityState === 'visible') load();
    };
    window.addEventListener('focus', recheck);
    document.addEventListener('visibilitychange', recheck);
    return () => {
      window.removeEventListener('focus', recheck);
      document.removeEventListener('visibilitychange', recheck);
    };
  }, [load]);

  const switchOrg = useCallback(
    async (orgId: string) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) return;

      // select() back so a write blocked by RLS surfaces as an error rather
      // than a reload into the wrong business.
      const res = await supabase
        .from('profiles')
        .update({ active_org_id: orgId })
        .eq('id', auth.user.id)
        .select('active_org_id')
        .maybeSingle();

      if (res.error || res.data?.active_org_id !== orgId) {
        setError(res.error?.message ?? 'Could not switch business. Try again.');
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
