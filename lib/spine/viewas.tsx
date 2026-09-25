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
import { guardApiWrites, setMode, setWorkOrg } from './readonly';
import type { Grant } from './workin';

const KEY = 'calo.viewas';
/**
 * The open work session, by id, so a page load does not end it.
 *
 * Only the id is stored. The grant itself is re-read on every load, which is
 * what makes "you can take this back at any time" work across a refresh: a
 * revoked or ended grant simply does not come back, and a client who turned
 * sending off between one page and the next is obeyed on the next page.
 */
const WORK_KEY = 'calo.workin';

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
  /**
   * The open work session, when there is one.
   *
   * Held here rather than in a provider of its own because looking and working
   * are two values of one thing, not two things. Two providers could both be
   * on, and "viewing and editing at the same time" is not a state anybody
   * should be able to reach.
   */
  work: Grant | null;
  setWork: (g: Grant | null) => void;
}

const ViewAsContext = createContext<Ctx>({
  viewAs: null,
  effectiveRole: null,
  setViewAs: () => {},
  myRole: null,
  setMyRole: () => {},
  work: null,
  setWork: () => {},
});

export function ViewAsProvider({ children }: { children: React.ReactNode }) {
  const [viewAs, setState] = useState<ViewAs | null>(null);
  const [work, setWorkState] = useState<Grant | null>(null);
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
   * Put an open session back after a reload, by asking the database.
   *
   * Not from storage: storage holds an id, and the answer to "may I still edit
   * here" belongs to the row. Re-reading it is what makes revocation take
   * effect on the next page rather than the next login, and it means a session
   * that ended in another tab does not come back to life in this one.
   */
  useEffect(() => {
    const id = (() => {
      try { return window.sessionStorage.getItem(WORK_KEY); } catch { return null; }
    })();
    if (!id) return;

    let off = false;
    void (async () => {
      const { grantById } = await import('./workin');
      const g = await grantById(id);
      if (off) return;
      if (g) setWorkState(g);
      else window.sessionStorage.removeItem(WORK_KEY);
    })();
    return () => { off = true; };
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
    /*
      Thrown here, in the same tick, and not left to the effect below.

      "Back to your studio" turns View mode off and immediately switches
      workspace, and switching writes profiles.active_org_id. A React state
      update does not flush before the next line of the handler runs, so the
      effect had not fired yet and the guard was still armed: the write was
      refused by a mode the user had just left. The visible result was the
      worst thing this app can do — the plate saying Blank Co over the studio's
      numbers, because the name had moved on and the write had not.

      The effect stays as the backstop for the other direction and for a value
      restored from session storage on load.
    */
    setMode(v ? 'view' : null);
    /* Looking and working cannot both be on. Entering one leaves the other. */
    if (v) setWorkState(null);
    setState(v);
  }, []);

  /**
   * Starting or ending a work session, in the same tick.
   *
   * The flag has to be set before the next line of the caller runs, for the
   * same reason View mode learned the hard way: a React state update does not
   * flush, and the handler that starts a session usually writes something
   * immediately afterwards.
   */
  const setWork = useCallback((g: Grant | null) => {
    setMode(g ? 'work' : null, g ? { canSend: g.canSend, grantId: g.id, actorId: g.grantedTo } : undefined);
    setWorkOrg(g ? g.orgId : null);
    if (g) {
      window.sessionStorage.setItem(WORK_KEY, g.id);
      /*
        Clear the STORED preview, not just the state.

        Setting React state to null left the session-storage key in place, so
        the next full page load restored View mode and the work session was
        gone. You pressed "Work in it", navigated once, and were quietly back
        to read-only with an open grant nobody was using.
      */
      window.sessionStorage.removeItem(KEY);
      setState(null);
    } else {
      window.sessionStorage.removeItem(WORK_KEY);
    }
    setWorkState(g);
  }, []);

  /*
    The read-only switch, thrown here rather than at the call sites.

    It is module state in readonly.ts, not React state, because a write can be
    fired by a debounce or an unmount effect that no component is waiting on,
    and those have to be refused too. This effect is the only thing that ever
    sets it, so the flag and the bar can never disagree about whether you are
    looking or working.

    The fetch guard is installed once, on mount, and does nothing at all while
    View mode is off.
  */
  useEffect(() => {
    guardApiWrites();
  }, []);

  useEffect(() => {
    if (work) {
      setMode('work', { canSend: work.canSend, grantId: work.id, actorId: work.grantedTo });
      setWorkOrg(work.orgId);
    } else {
      setMode(viewAs ? 'view' : null);
      setWorkOrg(null);
    }
    return () => { setMode(null); setWorkOrg(null); };
  }, [viewAs, work]);

  /*
    Leaving the page leaves the mode.

    Session storage survives a reload, which is what makes the mode hold while
    you click around. It also means a tab left in View mode overnight comes
    back in View mode, which is correct, and that the flag must be re-armed on
    load rather than assumed off. The effect above does that.
  */

  const value = useMemo<Ctx>(
    () => ({ viewAs, effectiveRole: viewAs?.role ?? myRole, setViewAs, myRole, setMyRole, work, setWork }),
    [viewAs, myRole, setViewAs, work, setWork]
  );

  return <ViewAsContext.Provider value={value}>{children}</ViewAsContext.Provider>;
}

export const useViewAs = () => useContext(ViewAsContext);
