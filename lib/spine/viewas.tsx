'use client';

/**
 * See the product as somebody else sees it.
 *
 * Everything in here already bends to who is looking: which rows are in the
 * sidebar, which setup tasks appear, what the empty screens say. None of that
 * could be checked without logging in as another person, so it was checked by
 * guessing, and the guesses were wrong — a tester opening Lakemere was asked
 * how she charges and how she wants to be paid, and nobody noticed until she
 * was about to be sent the link.
 *
 * WHY IT PRETENDS RATHER THAN SWITCHES
 *
 * Actually signing in as somebody else means having their password, or a way
 * to bypass one, and a product that can impersonate its users is a product one
 * bad afternoon away from a serious problem. This changes what is rendered and
 * nothing else. Every read still runs as you, under your own row-level rules,
 * so it cannot show data you were not already allowed to see.
 *
 * That is also its honest limit, and the banner says so: it answers "what
 * would she be shown", not "what can she reach".
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const KEY = 'calo.viewas';

export interface ViewAs {
  /** The role being previewed. Empty means you, as yourself. */
  role: string;
  /** Who you picked, for the banner. Not used for permissions. */
  label: string;
}

interface Ctx {
  viewAs: ViewAs | null;
  /** The role the interface should render for, yours or the pretended one. */
  effectiveRole: string | null;
  setViewAs: (v: ViewAs | null) => void;
  myRole: string | null;
  setMyRole: (r: string | null) => void;
}

const ViewAsContext = createContext<Ctx>({
  viewAs: null,
  effectiveRole: null,
  setViewAs: () => {},
  myRole: null,
  setMyRole: () => {},
});

export function ViewAsProvider({ children }: { children: React.ReactNode }) {
  const [viewAs, setState] = useState<ViewAs | null>(null);
  const [myRole, setMyRole] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(KEY);
      if (raw) setState(JSON.parse(raw) as ViewAs);
    } catch {
      /* a corrupt value is the same as none */
    }
  }, []);

  /**
   * Session storage, not local.
   *
   * A preview that survives closing the browser is a preview you forget you
   * are in, and then you file a bug about a screen that is not the screen you
   * actually have.
   */
  const setViewAs = useCallback((v: ViewAs | null) => {
    if (v) window.sessionStorage.setItem(KEY, JSON.stringify(v));
    else window.sessionStorage.removeItem(KEY);
    setState(v);
  }, []);

  const value = useMemo<Ctx>(
    () => ({ viewAs, effectiveRole: viewAs?.role ?? myRole, setViewAs, myRole, setMyRole }),
    [viewAs, myRole, setViewAs]
  );

  return <ViewAsContext.Provider value={value}>{children}</ViewAsContext.Provider>;
}

export const useViewAs = () => useContext(ViewAsContext);
