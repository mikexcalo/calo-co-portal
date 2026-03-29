'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { DB } from '@/lib/database';

export default function GlobalNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [, forceUpdate] = useState(0);

  // Re-render when clients load so breadcrumbs can resolve names
  useEffect(() => {
    if (DB.clientsState === 'loading') {
      const interval = setInterval(() => {
        if (DB.clientsState !== 'loading') {
          forceUpdate((n) => n + 1);
          clearInterval(interval);
        }
      }, 200);
      return () => clearInterval(interval);
    }
  }, []);

  // View toggle — only show on client detail pages
  const clientMatch = pathname.match(/^\/clients\/([^/]+)/);
  const isClientRoute = clientMatch && clientMatch[1] !== 'new';

  const [viewMode, setViewMode] = useState<'agency' | 'client'>('agency');
  const [bbAssetType, setBbAssetType] = useState<string | null>(null);

  // Build breadcrumbs from pathname
  const breadcrumbs = buildBreadcrumbs(pathname, bbAssetType);

  // Listen for brand builder asset type changes
  useEffect(() => {
    const handler = (e: Event) => setBbAssetType((e as CustomEvent).detail || null);
    window.addEventListener('bbAssetTypeChange', handler);
    return () => window.removeEventListener('bbAssetTypeChange', handler);
  }, []);

  // Clear asset type when leaving brand builder
  useEffect(() => {
    if (!pathname.includes('/brand-builder')) setBbAssetType(null);
  }, [pathname]);

  // Persist view mode
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('viewMode') : null;
    if (stored === 'client') setViewMode('client');
  }, []);

  const handleViewToggle = (mode: 'agency' | 'client') => {
    setViewMode(mode);
    localStorage.setItem('viewMode', mode);
    window.dispatchEvent(new CustomEvent('viewModeChange', { detail: mode }));
  };

  return (
    <nav
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        height: '56px',
        background: '#1a1f2e',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter, sans-serif',
      }}
    >
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      width: '100%', maxWidth: 980, padding: '0 24px',
    }}>
      {/* Left: Breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, overflow: 'hidden' }}>
        {breadcrumbs.map((crumb, i) => {
          const isLast = i === breadcrumbs.length - 1;
          return (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
              {i > 0 && (
                <span style={{ color: '#475569', fontSize: 11, flexShrink: 0 }}>/</span>
              )}
              {isLast ? (
                <span style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 600 }}>
                  {crumb.label}
                </span>
              ) : (
                <button
                  onClick={() => router.push(crumb.href!)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                    padding: 0,
                    fontFamily: 'Inter, sans-serif',
                    transition: 'color 0.12s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#e2e8f0')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                >
                  {crumb.label}
                </button>
              )}
            </span>
          );
        })}
      </div>

      {/* Right: View toggle + Settings */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        {isClientRoute && (
          <div
            style={{
              display: 'flex',
              border: '1.5px solid #475569',
              borderRadius: 7,
              overflow: 'hidden',
            }}
          >
            {(['agency', 'client'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => handleViewToggle(mode)}
                style={{
                  background: viewMode === mode ? '#2563eb' : 'transparent',
                  color: viewMode === mode ? '#ffffff' : '#94a3b8',
                  border: 'none',
                  padding: '5px 12px',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                  transition: 'all 0.12s',
                }}
              >
                {mode === 'agency' ? 'Agency' : 'Client'} View
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => router.push('/settings')}
          style={{
            background: 'none',
            border: 'none',
            color: pathname === '/settings' ? '#ffffff' : 'rgba(255,255,255,0.6)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 12,
            fontWeight: 600,
            fontFamily: 'Inter, sans-serif',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          Settings
        </button>
      </div>
    </div>
    </nav>
  );
}

interface Crumb {
  label: string;
  href?: string;
}

function buildBreadcrumbs(pathname: string, bbAssetType?: string | null): Crumb[] {
  const crumbs: Crumb[] = [];

  if (pathname === '/') {
    return [{ label: 'Agency Dashboard' }];
  }

  crumbs.push({ label: 'Agency Dashboard', href: '/' });

  // Match /clients/[id]
  const clientMatch = pathname.match(/^\/clients\/([^/]+)/);

  if (clientMatch) {
    const clientId = clientMatch[1];
    if (clientId === 'new') {
      crumbs.push({ label: 'New Client' });
      return crumbs;
    }

    const client = DB.clients.find((c) => c.id === clientId);
    const clientName = client?.company || client?.name || 'Client';

    const subPath = pathname.replace(`/clients/${clientId}`, '');

    if (!subPath || subPath === '/') {
      crumbs.push({ label: clientName });
    } else {
      crumbs.push({ label: clientName, href: `/clients/${clientId}` });

      const moduleMap: Record<string, string> = {
        '/brand-kit': 'Brand Kit',
        '/invoices': 'Invoices',
        '/invoices/new': 'New Invoice',
        '/financials': 'Financials',
        '/email-signature': 'Email Signature',
        '/brand-builder': 'Brand Builder',
      };

      if (subPath === '/invoices/new') {
        crumbs.push({ label: 'Invoices', href: `/clients/${clientId}/invoices` });
        crumbs.push({ label: 'New Invoice' });
      } else if (subPath === '/brand-builder' && bbAssetType) {
        crumbs.push({ label: 'Brand Builder', href: `/clients/${clientId}/brand-builder?reset=1` });
        crumbs.push({ label: bbAssetType });
      } else {
        crumbs.push({ label: moduleMap[subPath] || subPath.slice(1) });
      }
    }
    return crumbs;
  }

  // Top-level routes
  const topRoutes: Record<string, string> = {
    '/invoices': 'All Invoices',
    '/financials': 'Financials',
    '/settings': 'Settings',
    '/brand-kit': 'Agency Brand Kit',
    '/war-room': 'War Room',
  };

  crumbs.push({ label: topRoutes[pathname] || pathname.slice(1) });
  return crumbs;
}
