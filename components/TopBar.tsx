'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { DB } from '@/lib/database';
import { useTheme } from '@/lib/theme';

export default function TopBar() {
  const pathname = usePathname();
  const { t } = useTheme();
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'agency' | 'client'>('agency');
  const [avatar, setAvatar] = useState<string | null>(null);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('viewMode') : null;
    if (stored === 'client') setViewMode('client');

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

  const handleToggle = (mode: 'agency' | 'client') => {
    setViewMode(mode);
    localStorage.setItem('viewMode', mode);
    window.dispatchEvent(new CustomEvent('viewModeChange', { detail: mode }));
  };

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
        { label: moduleMap[sub] || sub.slice(1) },
      ];
    }

    const routes: Record<string, string> = {
      '/invoices': 'All Invoices', '/financials': 'Financials',
      '/settings': 'Settings', '/clients': 'Clients',
      '/agency/brand-kit': 'Agency Brand Kit',
      '/agency/design-studio': 'Agency Design Studio',
    };
    return [{ label: routes[pathname] || pathname.slice(1) }];
  };

  const segments = buildSegments();
  const isClientRoute = pathname.match(/^\/clients\/([^/]+)/) && !pathname.includes('/new');

  return (
    <div style={{
      height: 48, flexShrink: 0, background: t.bg.primary,
      borderBottom: `1px solid ${t.border.default}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 20px', fontFamily: 'inherit',
    }}>
      {/* Breadcrumb */}
      <div style={{ fontSize: 14, color: t.text.tertiary, display: 'flex', alignItems: 'center', gap: 6 }}>
        {segments.map((seg, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {i > 0 && <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.3" style={{ opacity: 0.4, flexShrink: 0, color: t.text.tertiary }}><polyline points="3 1.5 7 5 3 8.5" /></svg>}
            {seg.href ? (
              <span
                style={{ cursor: 'pointer', color: t.text.tertiary, fontWeight: 400 }}
                onClick={() => router.push(seg.href!)}
                onMouseEnter={(e) => (e.currentTarget.style.color = t.text.primary)}
                onMouseLeave={(e) => (e.currentTarget.style.color = t.text.tertiary)}
              >
                {seg.label}
              </span>
            ) : (
              <span style={{ color: i === segments.length - 1 ? t.text.primary : t.text.tertiary, fontWeight: i === segments.length - 1 ? 600 : 400 }}>{seg.label}</span>
            )}
          </span>
        ))}
      </div>

      {/* Right: client toggle + avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {isClientRoute && (
          <div style={{ display: 'inline-flex', borderRadius: 6, padding: 2, gap: 2 }}>
            {(['agency', 'client'] as const).map((m) => (
              <button key={m} onClick={() => handleToggle(m)} style={{
                padding: '4px 10px', fontSize: 12, fontWeight: viewMode === m ? 500 : 400,
                borderRadius: 4, border: 'none',
                background: viewMode === m ? t.text.primary : 'transparent',
                color: viewMode === m ? t.bg.primary : '#a1a1a5',
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
                {m === 'agency' ? 'Agency' : 'Client'}
              </button>
            ))}
          </div>
        )}
        {avatar ? (
          <img src={avatar} alt="" title="Settings" onClick={() => router.push('/settings?tab=profile')}
            style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', cursor: 'pointer' }} />
        ) : (
          <div title="Settings" onClick={() => router.push('/settings?tab=profile')}
            style={{ width: 30, height: 30, borderRadius: '50%', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>MC</div>
        )}
      </div>
    </div>
  );
}
