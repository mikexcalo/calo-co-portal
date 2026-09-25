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
import { workspaceColor } from '@/lib/spine/workspace-color';
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
  /*
    Pages a stranger can open, which must not render the app around them.

    Five were missing: pitches, the enquiry form, the QR hop, the review hop
    and the public trust page. So somebody who had never heard of this
    software opened a pitch and got the CALO&CO logo, a workspace chip,
    "Search or ask", and working-looking Add a note and Log time buttons.

    Nothing could actually be saved — every write is refused by row-level
    security with no session, verified against the live API — so this was a
    trust problem rather than a hole. It still cannot happen: a document sent
    to somebody else's customer should look like a document.

    /security is deliberately NOT here. It is the two-factor screen for a
    signed-in person and belongs inside the app. /trust is the public one.
  */
  const PUBLIC = [
    '/e/',        // a proposal
    '/i/',        // an invoice
    '/p/',        // a pitch
    '/s/',        // a case study
    '/c/',        // a contact card
    '/q/',        // a scanned QR code
    '/r/',        // the review hop
    '/new/',      // an enquiry form
    '/preview/',
  ];
  const isBarePage =
    pathname === '/login' ||
    pathname === '/welcome' ||
    pathname === '/trust' ||
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

  /*
    A module switched off has to stop rendering, not redirect after rendering.

    The effect above calls router.replace('/'), which fires after the page has
    already painted. So typing the address of a switched-off module showed the
    module — its heading, its data, its buttons — and then bounced. Long
    enough to read, and on a slow connection long enough to click.

    Blocked before children mount. The redirect above still runs and is what
    actually moves you; this is what stops you seeing the page while it does.

    Worth being straight about the limit: this is a product control, not a
    security boundary. A switched-off module is still the workspace's own
    data, so row-level security has no reason to refuse it and someone
    determined could read it through the API. Enforcing it server-side would
    mean a database lookup in middleware on every request, which is the cost
    that was just taken out. Hiding it in the interface is the right level for
    "you did not buy this"; it is not the right level for a secret, and
    nothing secret is behind one of these.
  */
  const blocked = !orgLoading && org && !pathAllowed(org, pathname);

  /* One resolver, shared with the name plate, so the two can never disagree
     about which business you are standing in. */
  const stripColor = workspaceColor(org);

  // Phone: the sidebar becomes a drawer. Desktop is unchanged.
  if (phone) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', paddingTop: 4 }}>
        <IdentityStrip color={stripColor} />
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

        <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {blocked ? <ModuleOff /> : children}
        </main>

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
    <div style={{ display: 'flex', height: '100vh', paddingTop: viewAs ? VIEW_AS_BAR : 4 }}>
      <IdentityStrip color={stripColor} />
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopBar />
        <main style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          {blocked ? <ModuleOff /> : children}
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

/**
 * What a switched-off module shows instead of itself.
 *
 * Says who can change it rather than just refusing, because the person
 * reading this is usually a client and the answer is always "ask the studio".
 * No data, no heading from the module, nothing that hints at what is behind
 * it — the point is that it is not theirs to see yet.
 */
function ModuleOff() {
  return (
    <div style={{ padding: '64px 28px', maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
      <div style={{ fontSize: 16, color: '#1a1a1a', marginBottom: 8 }}>
        This part is switched off
      </div>
      <div style={{ fontSize: 14, color: '#69727D', lineHeight: 1.6 }}>
        Nothing is lost. Whoever set this workspace up can turn it back on.
      </div>
    </div>
  );
}

/**
 * Four pixels of "which business is this".
 *
 * The one thing on screen that cannot be mistaken for content, in the one
 * place your eye passes over on the way to everything else. Near-black in the
 * studio, the client's own colour in a client — so switching workspace
 * changes something you notice without reading.
 *
 * Signed-in pages only. A proposal or an invoice belongs to the business that
 * sent it, and a stranger reading one should see their document, not a strip
 * from the software it was written in.
 */
function IdentityStrip({ color }: { color: string }) {
  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 4,
        background: color,
        zIndex: 200,
        pointerEvents: 'none',
      }}
    />
  );
}
