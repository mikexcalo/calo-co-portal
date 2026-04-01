'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { DB } from '@/lib/database';

export default function TopBar() {
  const pathname = usePathname();
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

  // Build breadcrumb from pathname
  const buildCrumb = (): string => {
    if (pathname === '/') return 'Dashboard';
    const clientMatch = pathname.match(/^\/clients\/([^/]+)/);
    if (clientMatch) {
      const clientId = clientMatch[1];
      if (clientId === 'new') return 'New Client';
      const client = DB.clients.find((c) => c.id === clientId);
      const name = client?.company || client?.name || 'Client';
      const sub = pathname.replace(`/clients/${clientId}`, '');
      const moduleMap: Record<string, string> = {
        '/brand-kit': 'Brand Kit', '/invoices': 'Invoices', '/invoices/new': 'New Invoice',
        '/financials': 'Financials', '/email-signature': 'Email Signature', '/brand-builder': 'Brand Builder',
      };
      if (!sub || sub === '/') return name;
      return `${name} / ${moduleMap[sub] || sub.slice(1)}`;
    }
    const routes: Record<string, string> = {
      '/invoices': 'All Invoices', '/financials': 'Financials',
      '/settings': 'Settings', '/brand-kit': 'Agency Brand Kit',
    };
    return routes[pathname] || pathname.slice(1);
  };

  const isClientRoute = pathname.match(/^\/clients\/([^/]+)/) && !pathname.includes('/new');

  return (
    <div style={{
      height: 48, flexShrink: 0, background: '#fff',
      borderBottom: '0.5px solid rgba(0,0,0,0.08)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 20px', fontFamily: 'Inter, sans-serif',
    }}>
      {/* Breadcrumb */}
      <div style={{ fontSize: 13, color: '#9ca3af' }}>{buildCrumb()}</div>

      {/* Right: toggle + avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {isClientRoute && (
          <div style={{ display: 'inline-flex', background: '#f1f3f5', borderRadius: 6, padding: 2 }}>
            {(['agency', 'client'] as const).map((m) => (
              <button key={m} onClick={() => handleToggle(m)} style={{
                padding: '4px 10px', fontSize: 11, fontWeight: viewMode === m ? 500 : 400,
                borderRadius: 4,
                border: viewMode === m ? '0.5px solid rgba(0,0,0,0.08)' : '0.5px solid transparent',
                background: viewMode === m ? '#fff' : 'transparent',
                color: viewMode === m ? '#111827' : '#9ca3af',
                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                boxShadow: viewMode === m ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}>
                {m === 'agency' ? 'Agency' : 'Client'}
              </button>
            ))}
          </div>
        )}
        <div style={{
          width: 30, height: 30, borderRadius: '50%', background: '#2563eb',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 11, fontWeight: 600,
        }}>MC</div>
      </div>
    </div>
  );
}
