'use client';

import { TourRunner } from '@/components/spine/TourRunner';
import { ViewAsBar } from '@/components/spine/ViewAsBar';
import { useViewAs } from '@/lib/spine/viewas';
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
  const { setMyRole } = useViewAs();
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

  const isBarePage = pathname === '/login' || pathname === '/welcome';

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
    <div style={{ display: 'flex', height: '100vh' }}>
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
    </div>
  );
}
