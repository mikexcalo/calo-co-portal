'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { DB } from '@/lib/database';

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'agency' | 'client'>('agency');

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('viewMode') : null;
    if (stored === 'client') setViewMode('client');
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
      height: 48, flexShrink: 0, background: '#0a0a0b',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 20px', fontFamily: 'inherit',
    }}>
      {/* Breadcrumb */}
      <div style={{ fontSize: 13, color: '#5a5a5d', display: 'flex', alignItems: 'center', gap: 6 }}>
        {segments.map((seg, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {i > 0 && <span style={{ color: '#3a3a3d' }}>/</span>}
            {seg.href ? (
              <span
                style={{ cursor: 'pointer', color: '#5a5a5d' }}
                onClick={() => router.push(seg.href!)}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#f5f5f5')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#5a5a5d')}
              >
                {seg.label}
              </span>
            ) : (
              <span style={{ color: i === segments.length - 1 && segments.length > 1 ? '#8a8a8d' : '#5a5a5d' }}>{seg.label}</span>
            )}
          </span>
        ))}
      </div>

      {/* Right: toggle + avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {isClientRoute && (
          <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: 2 }}>
            {(['agency', 'client'] as const).map((m) => (
              <button key={m} onClick={() => handleToggle(m)} style={{
                padding: '4px 10px', fontSize: 11, fontWeight: viewMode === m ? 500 : 400,
                borderRadius: 4,
                border: viewMode === m ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
                background: viewMode === m ? 'rgba(255,255,255,0.06)' : 'transparent',
                color: viewMode === m ? '#f5f5f5' : '#5a5a5d',
                cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: 'none',
              }}>
                {m === 'agency' ? 'Agency' : 'Client'}
              </button>
            ))}
          </div>
        )}
        <div
          onClick={() => router.push('/settings')}
          style={{
            width: 30, height: 30, borderRadius: '50%', background: '#2563eb',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer',
          }}
        >MC</div>
      </div>
    </div>
  );
}
