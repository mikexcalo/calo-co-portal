'use client';

import { TourRunner } from '@/components/spine/TourRunner';
import { SaveFailed } from '@/components/spine/SaveFailed';
import { ViewAsBar } from '@/components/spine/ViewAsBar';
import { useViewAs } from '@/lib/spine/viewas';
import { VIEW_AS_BAR } from '@/components/spine/ViewAsBar';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import { useIsPhone, C } from '@/components/spine/ui';
import { TutorialPanel } from '@/components/spine/TutorialPanel';
import supabase from '@/lib/supabase';
import { useOrg } from '@/lib/spine/org';
import { BottomBar } from '@/components/spine/BottomBar';
import { AddSheet } from '@/components/spine/AddSheet';
import { pathAllowed } from '@/lib/spine/modules';
import { PRODUCT } from '@/lib/brand';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const phone = useIsPhone();
  const { org, vocab, loading: orgLoading, orgs } = useOrg();
  const { setMyRole, viewAs } = useViewAs();
  const orgCount = orgs?.length ?? 0;

  /**
   * Has the person signed in ever introduced themselves?
   *
   * Read once rather than on every render, and `meLoaded` keeps the redirect
   * from firing during the moment before the answer arrives, which would
   * bounce an established user to setup on every page load.
   */
  const [meOnboarded, setMeOnboarded] = useState(false);
  const [meLoaded, setMeLoaded] = useState(false);

  /**
   * A DATE FIELD OPENS WHEN YOU CLICK THE DATE FIELD.
   *
   * A native date input only opens its picker from the little calendar glyph
   * at the right-hand end — about sixteen pixels of a three-hundred-pixel
   * control. Clicking anywhere else drops a caret into one segment of a date
   * you then have to type. Nobody aims for the glyph, because nothing about
   * the rest of the box says it is inert.
   *
   * There are seventeen date inputs in this product with different styles,
   * different props and different onChange shapes, and this is a browser
   * deficiency rather than a design decision — so it is fixed once, here,
   * rather than at seventeen call sites plus every one written after today.
   * showPicker is the browser's own answer and has been supported everywhere
   * that matters for years.
   */
  useEffect(() => {
    const open = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (!(el instanceof HTMLInputElement) || el.type !== 'date' || el.disabled || el.readOnly) return;
      // Firefox throws rather than no-opping, and an exception on click would
      // take the form down with it.
      try { (el as HTMLInputElement & { showPicker?: () => void }).showPicker?.(); } catch { /* ignore */ }
    };
    document.addEventListener('click', open);
    return () => document.removeEventListener('click', open);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) { setMeLoaded(false); return; }
      const { data } = await supabase
        .from('profiles')
        .select('full_name, role')
        .eq('id', auth.user.id)
        .maybeSingle();
      setMeOnboarded(Boolean(data?.full_name?.trim() && data?.role));
      setMyRole(data?.role ?? null);
      setMeLoaded(true);
    })();
  }, []);
  const [navOpen, setNavOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  /*
    Five public routes were being wrapped in the signed-in app.

    This listed /login and /welcome and nothing else, so every page a CLIENT
    is sent — a proposal, an invoice, a site preview — rendered inside the
    sidebar, the search bar and the workspace switcher. The document never got
    to render at all: the server returned the shell, titled CALO&CO, with
    "Loading…" where the proposal should be.

    Which means the link in John's email did not show him a proposal. It showed
    him the inside of somebody else's software, and then failed. The same is
    true of every invoice link already sent.

    These routes are the product's front door for people who do not have an
    account. They are bare, by definition.
  */
  const PUBLIC = ['/e/', '/i/', '/s/', '/c/', '/preview/'];
  const isBarePage =
    pathname === '/login' ||
    pathname === '/welcome' ||
    PUBLIC.some((p) => pathname.startsWith(p));

  /**
   * Switching to a business that doesn't have the module you're looking at
   * used to leave you stranded on a page missing from their nav — Brand Kit
   * still on screen after switching to a business without one. Bounce home.
   */
  useEffect(() => {
    if (isBarePage || orgLoading || !org) return;

    /**
     * Onboarding belongs to the person, not the workspace.
     *
     * The rule was "this business has no onboarded_at, so run setup". That is
     * right for somebody opening their own account and wrong for an agency
     * owner switching into a client: clicking into Lakemere threw up "Welcome
     * to CALO&CO, setting up Lakemere Services", and there was no way out
     * because the shell replaced the route on every render.
     *
     * Marking client workspaces as set up would have fixed that and broken the
     * opposite case, because the person those workspaces are handed to has
     * never answered anything either. So it asks whoever is signed in: have
     * you told us your name and what you do here. Once, ever, whichever
     * business they happen to be looking at.
     */
    if (meLoaded && !meOnboarded) {
      router.replace('/welcome');
      return;
    }

    if (!pathAllowed(org, pathname)) router.replace('/');
  }, [org, meLoaded, meOnboarded, orgLoading, pathname, isBarePage, router]);

  if (isBarePage) return <>{children}</>;

  // Phone: the sidebar becomes a drawer. Desktop is unchanged.
  if (phone) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 14px',
            borderBottom: `1px solid ${C.border}`,
            background: C.bg,
            position: 'sticky',
            top: 0,
            zIndex: 25,
          }}
        >
          <button
            onClick={() => setNavOpen(true)}
            aria-label="Open menu"
            style={{
              background: 'transparent',
              border: `1px solid ${C.border}`,
              borderRadius: 999,
              color: C.text,
              width: 36,
              height: 36,
              fontSize: 16,
              cursor: 'pointer',
            }}
          >
            ☰
          </button>
          <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.3px' }}>
            {PRODUCT}
          </span>
        </div>

        {navOpen && (
          <>
            <div
              onClick={() => setNavOpen(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 45 }}
            />
            <div
              onClick={() => setNavOpen(false)}
              style={{ position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 46 }}
            >
              <Sidebar />
            </div>
          </>
        )}

        <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>{children}</main>

        {/*
          A bar at the bottom rather than a drawer at the top. A hamburger
          costs a tap before you can see your options and puts them where a
          thumb reaches last; this puts the four things somebody does in a
          driveway permanently under the thumb.
        */}
        <BottomBar
          vocab={vocab}
          onMore={() => setNavOpen(true)}
          onAdd={() => setAddOpen(true)}
        />

        {addOpen && <AddSheet vocab={vocab} onClose={() => setAddOpen(false)} />}

        <TutorialPanel />
      </div>
    );
  }

  return (
    /*
      The preview bar takes its own room rather than sitting on top of things.

      It is position: fixed at the top of the window, which put it over the top
      bar: search, the workspace name and every control up there were sliced in
      half the moment you turned the preview on — on the screen whose whole job
      is showing you what somebody else sees. The shell is VIEW_AS_BAR shorter
      while it is on, so the bar has its own strip and nothing is underneath it.
    */
    <div style={{ display: 'flex', height: '100vh', paddingTop: viewAs ? VIEW_AS_BAR : 0 }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopBar />
        <main style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          {children}
        </main>
      </div>
      <TutorialPanel />
          {/* A tour walks across screens, so its dock lives above all of them. */}
      {/* Fixed rather than sticky, so where it sits in the tree cannot
          quietly stop it being visible. */}
      <ViewAsBar />
      <TourRunner />
      <SaveFailed />
    </div>
  );
}
