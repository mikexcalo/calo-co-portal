'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import { useIsPhone, C } from '@/components/spine/ui';
import { TutorialPanel } from '@/components/spine/TutorialPanel';
import { useOrg } from '@/lib/spine/org';
import { pathAllowed } from '@/lib/spine/modules';
import { PRODUCT } from '@/lib/brand';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const phone = useIsPhone();
  const { org, loading: orgLoading } = useOrg();
  const [navOpen, setNavOpen] = useState(false);

  const isBarePage = pathname === '/login' || pathname === '/welcome';

  /**
   * Switching to a business that doesn't have the module you're looking at
   * used to leave you stranded on a page missing from their nav — Brand Kit
   * still on screen after switching to a business without one. Bounce home.
   */
  useEffect(() => {
    if (isBarePage || orgLoading || !org) return;

    // First login: the app cannot invoice without a rate or say how to pay
    // without a method, so ask once before anything else.
    if (!org.onboarded_at) {
      router.replace('/welcome');
      return;
    }

    if (!pathAllowed(org, pathname)) router.replace('/');
  }, [org, orgLoading, pathname, isBarePage, router]);

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
              borderRadius: 7,
              color: C.text,
              width: 36,
              height: 36,
              fontSize: 15,
              cursor: 'pointer',
            }}
          >
            ☰
          </button>
          <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.3px' }}>
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
    </div>
  );
}
