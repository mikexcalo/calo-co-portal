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
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { forgetOrg } from '@/lib/spine/db';
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

/*
  Projects, not engagements.

  "Engagement" is consultancy-speak. It is the word a firm uses on an invoice
  to a procurement department, and it means nothing to anybody standing in
  front of the actual work — Mike opened his own sidebar and could not say what
  the row was for or how it differed from Home. A word you have to translate
  before you can use the screen is a bad word, however correct it is.

  Project is what the thing is: a named piece of work for one client, with a
  start, a cost and an end. Same record, same table; the contractor still calls
  it a Job.
*/
const AGENCY: Vocab = {
  job: 'Project',
  jobPlural: 'Projects',
  customer: 'Client',
  customerPlural: 'Clients',
  estimate: 'Proposal',
  lead: 'Prospect',
};

/**
 * The word for the thing you send before the invoice.
 *
 * Two kinds was one too few. A contractor sends an estimate, an agency sends a
 * proposal, and John — who distributes seafood — sends neither: he quotes. The
 * kind of business gets it right most of the time and the exception is not
 * rare enough to live with, because this word is on the document a client
 * receives.
 *
 * So the business can override it, and the rest of the vocabulary still comes
 * from what kind of business it is.
 */
/*
  A rep's words are neither set.

  He has no jobs and no customers in the sense either of the others mean. The
  companies on his Clients screen are the ones he REPRESENTS — they pay him,
  they do not buy from him — and what he sends a buyer is a quote off somebody
  else's sheet, not an estimate for work he will do.
*/
const REP: Vocab = {
  job: 'Project',
  jobPlural: 'Projects',
  customer: 'Principal',
  customerPlural: 'Principals',
  estimate: 'Quote',
  lead: 'Buyer',
};

export const vocabFor = (kind: Org['kind'] | undefined, settings?: Record<string, unknown> | null): Vocab => {
  const base = kind === 'agency' ? AGENCY : kind === 'rep' ? REP : CONTRACTOR;
  const word = typeof settings?.estimate_word === 'string' ? settings.estimate_word.trim() : '';
  return word ? { ...base, estimate: word } : base;
};

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
  const router = useRouter();
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

  /*
    The name on the plate and the data on the page read from two places.

    This context resolves the workspace for display. orgNow() in db.ts keeps
    its own module-level cache, and nearly every query filters on that. They
    query the same column, so they agree — until one of them is stale, and
    then the sidebar says one business while the screen shows another's rows.
    That is the single worst thing this app could do, and nothing was stopping
    it structurally; it was only ever prevented by the old full page reload
    clearing both.

    Now the switch is client-side, so: whenever the displayed workspace
    changes, for any reason, the query cache is dropped. The name cannot lead
    the data.
  */
  useEffect(() => {
    forgetOrg();
  }, [org?.id]);

  const switchOrg = useCallback(
    async (orgId: string) => {
      /*
        getSession, not getUser.

        getUser revalidates the token against the auth server — a network round
        trip before anything else can start. Switching business is the thing
        Mike does most often in a day and it was paying for that hop every
        time, on top of the write and the reload. The session is already in
        memory; the id is on it.

        The same lesson is written on orgNow() a few files over, where it is
        called the whole reason the app got slow one afternoon.
      */
      const { data: auth } = await supabase.auth.getSession();
      const userId = auth?.session?.user?.id;
      if (!userId) return;

      // select() back so a write blocked by RLS surfaces as an error rather
      // than a reload into the wrong business.
      const res = await supabase
        .from('profiles')
        .update({ active_org_id: orgId })
        .eq('id', userId)
        .select('active_org_id')
        .maybeSingle();

      if (res.error || res.data?.active_org_id !== orgId) {
        setError(res.error?.message ?? 'Could not switch business. Try again.');
        return;
      }

      /*
        This was window.location.reload(), and that was the six to thirteen
        seconds.

        A full document load: fetch the HTML, parse it, download and execute
        every script, run middleware again, hydrate, then let every page on
        screen re-query from nothing. The reasoning written here was sound —
        every open page is showing the other business's data — but the answer
        to "this page is stale" is to leave the page, not to rebuild the
        browser.

        It also reloaded the CURRENT url, which is the second half of the
        complaint: switching from a client's Settings landed you on the next
        client's Settings, with a Save button over a form you had not filled
        in.

        Now: forget the cached org id, swap the context in memory, and
        navigate to Home. AppShell keys its children on the workspace id, so
        every page unmounts and the new one mounts clean — no carried-over
        form, no open panel, no stale row. One client-side navigation instead
        of a cold start.
      */
      forgetOrg();

      const next = orgs.find((o) => o.id === orgId) ?? null;
      if (next) setOrg(next);   // instant: the plate and strip change now
      setError(null);

      /* replace, not push: the workspace you just left is not a place to go
         back to, and Back should leave the app rather than silently return
         you to another business's screen. */
      router.replace('/');

      /* Reconcile against the database afterwards. If the optimistic pick was
         somehow wrong, this corrects it a moment later rather than blocking
         the switch on a round trip. */
      void load();
    },
    [orgs, router, load]
  );

  return (
    <OrgContext.Provider
      value={{
        org,
        orgs,
        vocab: vocabFor(org?.kind, org?.settings as Record<string, unknown> | null),
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
