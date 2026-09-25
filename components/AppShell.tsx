'use client';

import { TourRunner } from '@/components/spine/TourRunner';
import { SaveFailed } from '@/components/spine/SaveFailed';
import { useViewAs } from '@/lib/spine/viewas';
import { ViewModeBar, VIEW_BAR, VIEW_BAR_PHONE } from '@/components/spine/ViewModeBar';
import { ClientPanel } from '@/components/spine/ClientPanel';
import { WorkModeBar, WorkRequest, WORK_BAR, WORK_BAR_PHONE } from '@/components/spine/WorkModeBar';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import { useIsPhone, C, radius } from '@/components/spine/ui';
import { TutorialPanel } from '@/components/spine/TutorialPanel';
import supabase from '@/lib/supabase';
import { useOrg } from '@/lib/spine/org';
import { BottomBar } from '@/components/spine/BottomBar';
import { AddSheet } from '@/components/spine/AddSheet';
import { pathAllowed } from '@/lib/spine/modules';
import { workspaceColor } from '@/lib/spine/workspace-color';
import { OrgSwitcher } from '@/components/spine/OrgSwitcher';
import { PRODUCT } from '@/lib/brand';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const phone = useIsPhone();
  const { org, vocab, loading: orgLoading, orgs } = useOrg();
  const { setMyRole, viewAs, work } = useViewAs();
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
    The request behind an open work session, loaded once.

    Only when there is one: a session the studio started on its own has no
    feedback row, and the top of the page stays empty rather than showing a
    heading with nothing under it.
  */
  const [request, setRequest] = useState<{ body: string; created_at: string } | null>(null);
  useEffect(() => {
    let off = false;
    setRequest(null);
    const id = work?.feedbackId;
    if (!id) return;
    (async () => {
      const res = await supabase.from('feedback').select('body, created_at').eq('id', id).maybeSingle();
      if (!off && res.data) setRequest(res.data as { body: string; created_at: string });
    })();
    return () => { off = true; };
  }, [work?.feedbackId]);
  /*
    Above the early return, and it has to stay there.

    This was declared further down, after `if (isBarePage) return children`.
    A bare page therefore ran twelve hooks and an in-app page ran thirteen, so
    the first CLIENT-SIDE move across that line rendered more hooks than the
    render before it and React threw #310 — "Application error: a client-side
    exception has occurred", nothing else on screen.

    Signing in is exactly that move: /login is bare, the login page finishes
    with router.push('/'), and / is not. A hard load of either page is fine,
    which is why it hid — every other way into the app reloads the document.

    Hooks cannot sit behind a conditional return. Not a style rule.
  */
  const [pickerOpen, setPickerOpen] = useState(false);

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

  /*
    View mode only means anything inside somebody else's workspace.

    In your own studio "what they see" previews you, which is why the control
    is hidden there. Checking the org's kind here as well means a stale flag in
    session storage cannot frame your own screen in blue and refuse your own
    writes.
  */
  const viewing = Boolean(viewAs) && !!org && org.kind !== 'agency';
  /*
    Working is the same test with a grant instead of a preview, and the two
    can never both be true: the provider clears one when the other is set.
  */
  const working = !!work && !!org && work.orgId === org.id;
  /* One flag for "inside somebody else's workspace", and the colour that says
     which kind. The phone layout below is the same for both. */
  const framed = viewing || working;
  const frameColor = viewing ? C.viewing : C.working;

  // Phone: the sidebar becomes a drawer. Desktop is unchanged.
  if (phone) {
    return (
      /*
        View mode on a phone.

        Same promise, laid out for a thumb: the blue bar wraps onto two rows
        and its buttons sit under the sentence, and the frame becomes an 8px
        blue edge around the whole column rather than a border beside a panel.

        The private column cannot sit beside anything at this width, so it goes
        underneath, below the client's screen, still outside the framed part.
        Scrolling to it is a deliberate move, which is the right shape: you
        came here to look at their screen, and your own notes are a step
        further down rather than something covering it.
      */
      <div
        style={{
          display: 'flex', flexDirection: 'column', minHeight: '100vh',
          paddingTop: framed ? (viewing ? VIEW_BAR_PHONE : WORK_BAR_PHONE) + 8 : 4,
          background: framed ? frameColor : undefined,
          boxSizing: 'border-box',
          gap: framed ? 8 : 0,
          paddingLeft: framed ? 8 : 0,
          paddingRight: framed ? 8 : 0,
          paddingBottom: framed ? 8 : 0,
        }}
      >
        {/*
          Both modes, one layout.

          The phone branch returns before the desktop ones, so handling only
          View mode here meant Work mode had no frame and no bar at this width:
          a session that looked from a phone exactly like standing in the
          client's workspace as yourself, which is the one thing the colour
          exists to prevent.
        */}
        {viewing ? <ViewModeBar /> : working ? <WorkModeBar /> : <IdentityStrip color={stripColor} />}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 14px',
            borderBottom: `1px solid ${C.border}`,
            background: C.bg,
            /* In View mode it is the top of a framed box rather than the top
               of the window, so it rounds, carries the client's colour as its
               own edge, and stops sticking: the blue bar above it is already
               fixed, and two stacked sticky rows on a phone is most of the
               screen. */
            borderTop: framed ? `4px solid ${stripColor}` : undefined,
            borderTopLeftRadius: framed ? radius.lg : undefined,
            borderTopRightRadius: framed ? radius.lg : undefined,
            position: framed ? 'relative' : 'sticky',
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
          {/*
            The workspace, and a way out of it, without opening the drawer.

            This said the product name, so on a phone the one fact you need
            was two taps away behind ☰ — and the switcher itself was in a top
            bar that does not render at this width, which is why switching on
            a phone was not possible at all.

            Tapping the name opens the same picker as the plate, which draws
            itself as a sheet from the bottom on a narrow screen.
          */}
          <button
            onClick={() => setPickerOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1,
              background: 'transparent', border: 'none', padding: 0,
              cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
            }}
          >
            <span
              aria-hidden
              style={{
                width: 24, height: 24, borderRadius: 7, flexShrink: 0,
                background: stripColor,
              }}
            />
            <span
              style={{
                fontSize: 17, fontWeight: 600, letterSpacing: '-0.3px',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >
              {org?.name ?? PRODUCT}
            </span>
            <span style={{ fontSize: 11, color: C.faint, flexShrink: 0 }}>▾</span>
          </button>
        </div>

        {pickerOpen && <OrgSwitcher onClose={() => setPickerOpen(false)} />}

        {navOpen && (
          <>
            <div
              onClick={() => setNavOpen(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 45 }}
            />
            {/*
              Below the blue bar, not underneath it.

              The drawer is fixed to the top of the window and so is the View
              mode bar, and the bar wins on z-index, so at phone width the
              first two rows of the drawer — the product name and the workspace
              plate — were sitting behind it. Measured in a 390px frame: the
              drawer opened at "Search or ask".
            */}
            <div
              onClick={() => setNavOpen(false)}
              style={{
                position: 'fixed',
                top: framed ? (viewing ? VIEW_BAR_PHONE : WORK_BAR_PHONE) : 0,
                left: 0,
                bottom: 0,
                zIndex: 46,
              }}
            >
              <Sidebar />
            </div>
          </>
        )}

        {/*
          Keyed on the workspace, so switching unmounts everything.

          Without this a client-side switch leaves the current page mounted
          with the previous business's rows in its state, and any half-filled
          form still holding what you typed. React tears the whole subtree
          down and builds it again when the key changes, which is exactly the
          guarantee the old full reload was buying at the cost of ten seconds.
        */}
        <main
          key={org?.id ?? 'none'}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            background: framed ? C.bg : undefined,
            borderBottomLeftRadius: framed ? radius.lg : undefined,
            borderBottomRightRadius: framed ? radius.lg : undefined,
          }}
        >
          {/* What they asked for, above the page, for the whole session. */}
          {working && request && (
            <div style={{ padding: '14px 14px 0' }}>
              <WorkRequest body={request.body} at={request.created_at} canSend={work?.canSend ?? false} />
            </div>
          )}
          {blocked ? <ModuleOff /> : children}
        </main>

        {/* Outside the client's screen, under it. Comment above the
            conditional: {x && (...)} takes exactly one child. */}
        {viewing && <ClientPanel />}

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

  /*
    Work mode: the same frame, a different colour, and the request pinned.

    Deliberately the same shape as View mode rather than a second layout. The
    two are one idea - you are inside somebody else's workspace and the screen
    says so - and building them differently would make the difference between
    looking and editing a matter of noticing which controls are present.

    No private panel. That column is a View mode thing: it exists so you can
    read a client without touching them. Here you are touching them, and the
    thing that belongs at the top is what they asked for.
  */
  if (working && work) {
    return (
      <div
        style={{
          display: 'flex', flexDirection: 'column', height: '100vh',
          paddingTop: phone ? WORK_BAR_PHONE : WORK_BAR,
          background: C.working, boxSizing: 'border-box',
        }}
      >
        <WorkModeBar />
        <div style={{ flex: 1, minHeight: 0, display: 'flex', padding: 8, boxSizing: 'border-box' }}>
          <div
            style={{
              flex: 1, minWidth: 0, display: 'flex', position: 'relative',
              background: C.bg, borderRadius: radius.lg, overflow: 'hidden',
            }}
          >
            <div
              aria-hidden
              style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 4,
                background: stripColor, zIndex: 3,
              }}
            />
            <Sidebar />
            <main style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
              {/* Above the page, not inside it, so it survives every
                  navigation for the length of the session. */}
              {request && (
                <div style={{ padding: '18px 28px 0' }}>
                  <WorkRequest body={request.body} at={request.created_at} canSend={work.canSend} />
                </div>
              )}
              <div key={org?.id ?? 'none'} style={{ display: 'contents' }}>
                {blocked ? <ModuleOff /> : children}
              </div>
            </main>
          </div>
        </div>
        <SaveFailed />
      </div>
    );
  }

  /*
    View mode: the whole workspace inside a blue frame, and your notes outside it.

    The frame is the point. A banner can be scrolled past and a tinted corner
    can be missed; a border around everything cannot, and it draws the line
    this mode depends on — inside is theirs, outside is yours. The private
    panel sits outside the frame for that reason and no other.

    The top bar does not render. It is the studio's row of controls — Add a
    note, Log time, what they see, your site, your notifications, your avatar —
    and none of it is on the client's screen or usable while nothing can be
    written. The two things worth keeping from it, leaving and switching, are
    in the blue bar.

    The strip stays, in the client's own colour, at the top of their workspace
    rather than the top of the window, because in here it belongs to the box it
    labels.
  */
  if (viewing) {
    return (
      <div
        style={{
          display: 'flex', flexDirection: 'column', height: '100vh',
          paddingTop: phone ? VIEW_BAR_PHONE : VIEW_BAR,
          background: C.viewing, boxSizing: 'border-box',
        }}
      >
        <ViewModeBar />
        <div
          style={{
            flex: 1, minHeight: 0, display: 'flex',
            gap: 8, padding: 8, boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              flex: 1, minWidth: 0, display: 'flex', position: 'relative',
              background: C.bg, borderRadius: radius.lg, overflow: 'hidden',
            }}
          >
            <div
              aria-hidden
              style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 4,
                background: stripColor, zIndex: 3,
              }}
            />
            <Sidebar />
            <main style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
              <div key={org?.id ?? 'none'} style={{ display: 'contents' }}>
                {blocked ? <ModuleOff /> : children}
              </div>
            </main>
          </div>
          {/* Never on a phone: 316px of notes beside a 212px sidebar on a
              360px screen is neither. It goes under the workspace instead. */}
          {!phone && <ClientPanel />}
        </div>
        <SaveFailed />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', paddingTop: 4 }}>
      <IdentityStrip color={stripColor} />
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopBar />
        <main style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div key={org?.id ?? 'none'} style={{ display: 'contents' }}>
            {blocked ? <ModuleOff /> : children}
          </div>
        </main>
      </div>
      <TutorialPanel />
          {/* A tour walks across screens, so its dock lives above all of them. */}
      {/* Fixed rather than sticky, so where it sits in the tree cannot
          quietly stop it being visible. */}
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
