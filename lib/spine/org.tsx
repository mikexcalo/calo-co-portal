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
import { forgetOrg, setKnownOrg } from '@/lib/spine/db';
import type { Org } from './types';

/*
  The words themselves are in `vocab.ts`, which is not a client module.

  They were declared here, and this file opens with `'use client'`, so the two
  server-rendered documents a customer receives - the proposal and the invoice
  - could not call `vocabFor` at all: a server component importing from a
  client module gets a reference rather than the function, and calling it
  throws. Every proposal link in the product was a blank page for two days
  because of it.

  Re-exported so nothing that imports them from here has to change.
*/
export type { Vocab } from './vocab';
export { aWord, capWord, vocabFor } from './vocab';

import { vocabFor, type Vocab } from './vocab';

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
  /* The default kind's words, from the one place that decides them. */
  vocab: vocabFor(undefined),
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
    if (!org?.id) { forgetOrg(); return; }
    /* Set rather than clear: same guarantee that the query cache can never
       lag the name on screen, without the round trip that re-reading it
       would cost. */
    void (async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id;
      if (uid) setKnownOrg(uid, org.id);
      else forgetOrg();
    })();
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
      /*
        Tell the query cache, do not make it ask.

        Measured: every Supabase round trip from a browser to this project is
        230-800ms, averaging about 350, while the database work behind it is
        under 20ms. So the cost of a switch is not the work, it is the number
        of serial hops — and three of them were avoidable.

        forgetOrg() made the next query re-read profiles.active_org_id, a
        column we had just written and whose value is in the variable above.
      */
      setKnownOrg(userId, orgId);

      const next = orgs.find((o) => o.id === orgId) ?? null;
      if (next) setOrg(next);   // instant: the plate and strip change now
      setError(null);

      /* replace, not push: the workspace you just left is not a place to go
         back to, and Back should leave the app rather than silently return
         you to another business's screen. */
      router.replace('/');

      /*
        No reconcile pass. It used to call load(), which is getUser() plus two
        more queries — three hops to confirm something the UPDATE above
        already confirmed: it wrote the value and read it back with .select(),
        and refuses to continue if the two disagree.

        The orgs list is already in memory and did not change; only which one
        is active did, and that is set above.
      */
    },
    [orgs, router]
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
