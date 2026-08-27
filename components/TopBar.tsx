'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { DB } from '@/lib/database';
import { useTheme } from '@/lib/theme';
import { useTutorial } from '@/lib/spine/tutorial';
import { C } from '@/components/spine/ui';
import { QuickAdd } from '@/components/shared/QuickAdd';

export default function TopBar() {
  const pathname = usePathname();
  const { t } = useTheme();
  const { openPanel } = useTutorial();
  const router = useRouter();
  const [avatar, setAvatar] = useState<string | null>(null);

  useEffect(() => {
    // Read avatar immediately
    const av = localStorage.getItem('calo-agency-avatar');
    if (av && av.startsWith('data:image/')) setAvatar(av);

    // Listen for changes (both cross-tab AND same-tab dispatched StorageEvents)
    const handler = () => {
      const val = localStorage.getItem('calo-agency-avatar');
      setAvatar(val && val.startsWith('data:image/') ? val : null);
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  // Build breadcrumb segments: { label, href? }
  const buildSegments = (): { label: string; href?: string }[] => {
    if (pathname === '/') return [{ label: 'Dashboard' }];

    const clientMatch = pathname.match(/^\/clients\/([^/]+)/);
    if (clientMatch) {
      const clientId = clientMatch[1];
      if (clientId === 'new') return [{ label: 'New Client' }];

      const client = DB.clients.find((c) => c.id === clientId);
      const name = client?.company || client?.name || 'Client';
      const sub = pathname.replace(`/clients/${clientId}`, '');
      const moduleMap: Record<string, string> = {
        '/brand-kit': 'Brand Kit', '/invoices': 'Invoices', '/invoices/new': 'New Invoice',
        '/financials': 'Financials', '/email-signature': 'Email Signature', '/brand-builder': 'Design Studio',
      };

      if (!sub || sub === '/') return [
        { label: 'Clients', href: '/clients' },
        { label: name },
      ];
      return [
        { label: 'Clients', href: '/clients' },
        { label: name, href: `/clients/${clientId}` },
        { label: moduleMap[sub] || sub.slice(1).replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) },
      ];
    }

    const routes: Record<string, string> = {
      '/quotes': 'Quotes', '/quotes/new': 'New Quote',
      '/invoices': 'All Invoices', '/financials': 'Financials',
      '/settings': 'Settings', '/clients': 'Clients',
      '/design': 'Design Studio', '/studio': 'Design Studio',
      '/brand-kit': 'Brand Kit',
      '/agency/brand-kit': 'Agency Brand Kit',
      '/agency/design-studio': 'Agency Design Studio',
    };
    return [{ label: routes[pathname] || pathname.split('/').pop()?.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || pathname.slice(1) }];
  };

  const segments = buildSegments();
  return (
    <div style={{
      height: 56, flexShrink: 0, background: t.bg.primary,
      borderBottom: `1px solid ${t.border.default}`,
      display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
      padding: '0 16px', fontFamily: 'inherit',
    }}>

      <QuickAdd />

      {/* Right: search + toggle + avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Was a dark/light toggle. A theme switch doubled every colour
            decision and taught nobody anything; guided paths do. */}
        <button
          onClick={openPanel}
          title="Learn Nautilus"
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            height: 32, padding: '0 12px', borderRadius: 6,
            border: `1px solid ${C.borderStrong}`, background: C.panel,
            cursor: 'pointer', color: C.text, fontSize: 12.5,
            fontWeight: 500, fontFamily: 'inherit',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 3.5h4.5A1.5 1.5 0 0 1 8 5v8a1.2 1.2 0 0 0-1.2-1.2H2z" />
            <path d="M14 3.5H9.5A1.5 1.5 0 0 0 8 5v8a1.2 1.2 0 0 1 1.2-1.2H14z" />
          </svg>
          Learn
        </button>
        {avatar ? (
          <img src={avatar} alt="" title="Settings" onClick={() => router.push('/settings?tab=profile')}
            style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', cursor: 'pointer' }} />
        ) : (
          <div title="Settings" onClick={() => router.push('/settings?tab=profile')}
            style={{ width: 32, height: 32, borderRadius: '50%', background: t.accent.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>MC</div>
        )}
      </div>
    </div>
  );
}
