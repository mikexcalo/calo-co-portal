'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { DB } from '@/lib/database';
import { initials } from '@/lib/utils';

export default function GlobalNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [, forceUpdate] = useState(0);
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Re-render when clients load so breadcrumbs can resolve names
  useEffect(() => {
    if (DB.clientsState === 'loading') {
      const interval = setInterval(() => {
        if (DB.clientsState !== 'loading') { forceUpdate((n) => n + 1); clearInterval(interval); }
      }, 200);
      return () => clearInterval(interval);
    }
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setClientDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const clientMatch = pathname.match(/^\/clients\/([^/]+)/);
  const isClientRoute = clientMatch && clientMatch[1] !== 'new';
  const currentClientId = isClientRoute ? clientMatch![1] : null;

  const [viewMode, setViewMode] = useState<'agency' | 'client'>('agency');
  const [bbAssetType, setBbAssetType] = useState<string | null>(null);

  const breadcrumbs = buildBreadcrumbs(pathname, bbAssetType);

  useEffect(() => {
    const handler = (e: Event) => setBbAssetType((e as CustomEvent).detail || null);
    window.addEventListener('bbAssetTypeChange', handler);
    return () => window.removeEventListener('bbAssetTypeChange', handler);
  }, []);

  useEffect(() => {
    if (!pathname.includes('/brand-builder')) setBbAssetType(null);
  }, [pathname]);

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
    <nav style={{
      position: 'sticky', top: 0, zIndex: 100, height: '56px', background: '#1a1f2e',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif',
    }}>
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      width: '100%', maxWidth: 980, padding: '0 24px',
    }}>
      {/* Left: Breadcrumbs only — no CALO&CO (#1) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, overflow: 'hidden' }}>
        {breadcrumbs.map((crumb, i) => {
          const isLast = i === breadcrumbs.length - 1;
          const isClientCrumb = crumb.isClient;
          return (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', position: 'relative' }}>
              {i > 0 && <span style={{ color: '#475569', fontSize: 11, flexShrink: 0 }}>/</span>}
              {isLast && !isClientCrumb ? (
                <span style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 600 }}>{crumb.label}</span>
              ) : isClientCrumb ? (
                <div ref={isClientCrumb ? dropdownRef : undefined} style={{ position: 'relative' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isLast) setClientDropdownOpen((v) => !v);
                      else router.push(crumb.href!);
                    }}
                    style={{
                      background: 'none', border: 'none', padding: '2px 0',
                      color: isLast ? '#f1f5f9' : '#94a3b8', fontSize: 13,
                      fontWeight: isLast ? 600 : 500, cursor: 'pointer',
                      fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: 4,
                    }}
                    onMouseEnter={(e) => { if (!isLast) e.currentTarget.style.color = '#e2e8f0'; }}
                    onMouseLeave={(e) => { if (!isLast) e.currentTarget.style.color = '#94a3b8'; }}
                  >
                    {crumb.label}
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ opacity: 0.5 }}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  {clientDropdownOpen && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, marginTop: 6,
                      background: '#1e293b', border: '1px solid #334155', borderRadius: 8,
                      padding: '6px 0', minWidth: 240, maxHeight: 300, overflowY: 'auto',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 200,
                    }}>
                      {DB.clients.map((c) => {
                        const isCurrent = c.id === currentClientId;
                        return (
                          <button key={c.id} onClick={() => {
                            setClientDropdownOpen(false);
                            localStorage.setItem(`client_accessed_${c.id}`, String(Date.now()));
                            router.push(`/clients/${c.id}`);
                          }} style={{
                            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                            padding: '8px 14px', border: 'none', cursor: 'pointer', textAlign: 'left',
                            background: isCurrent ? '#334155' : 'transparent',
                            fontFamily: 'Inter, sans-serif',
                          }}
                          onMouseEnter={(e) => { if (!isCurrent) e.currentTarget.style.background = '#293548'; }}
                          onMouseLeave={(e) => { if (!isCurrent) e.currentTarget.style.background = 'transparent'; }}
                          >
                            {c.logo ? (
                              <img src={c.logo} alt="" style={{ width: 22, height: 22, borderRadius: 4, objectFit: 'cover' }} />
                            ) : (
                              <div style={{
                                width: 22, height: 22, borderRadius: 4, background: '#475569',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 9, fontWeight: 700, color: '#e2e8f0', flexShrink: 0,
                              }}>
                                {(c.company || c.name || '?').charAt(0)}
                              </div>
                            )}
                            <span style={{
                              fontSize: 12, color: isCurrent ? '#f1f5f9' : '#94a3b8', fontWeight: isCurrent ? 600 : 400,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {c.company || c.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <button onClick={() => router.push(crumb.href!)} style={{
                  background: 'none', border: 'none', color: '#94a3b8', fontSize: 13,
                  fontWeight: 500, cursor: 'pointer', padding: 0, fontFamily: 'Inter, sans-serif',
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
          <div style={{ display: 'flex', border: '1.5px solid #475569', borderRadius: 7, overflow: 'hidden' }}>
            {(['agency', 'client'] as const).map((mode) => (
              <button key={mode} onClick={() => handleViewToggle(mode)} style={{
                background: viewMode === mode ? '#2563eb' : 'transparent',
                color: viewMode === mode ? '#ffffff' : '#94a3b8',
                border: 'none', padding: '5px 12px', fontSize: 11, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}>
                {mode === 'agency' ? 'Agency' : 'Client'} View
              </button>
            ))}
          </div>
        )}
        <button onClick={() => router.push('/settings')} style={{
          background: 'none', border: 'none',
          color: pathname === '/settings' ? '#ffffff' : 'rgba(255,255,255,0.6)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
          fontSize: 12, fontWeight: 600, fontFamily: 'Inter, sans-serif',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
  isClient?: boolean;
}

function buildBreadcrumbs(pathname: string, bbAssetType?: string | null): Crumb[] {
  const crumbs: Crumb[] = [];

  if (pathname === '/') return [{ label: 'Dashboard' }];
  crumbs.push({ label: 'Dashboard', href: '/' });

  const clientMatch = pathname.match(/^\/clients\/([^/]+)/);
  if (clientMatch) {
    const clientId = clientMatch[1];
    if (clientId === 'new') { crumbs.push({ label: 'New Client' }); return crumbs; }

    const client = DB.clients.find((c) => c.id === clientId);
    const clientName = client?.company || client?.name || 'Client';
    const subPath = pathname.replace(`/clients/${clientId}`, '');

    if (!subPath || subPath === '/') {
      crumbs.push({ label: clientName, isClient: true });
    } else {
      crumbs.push({ label: clientName, href: `/clients/${clientId}`, isClient: true });
      const moduleMap: Record<string, string> = {
        '/brand-kit': 'Brand Kit', '/invoices': 'Invoices', '/invoices/new': 'New Invoice',
        '/financials': 'Financials', '/email-signature': 'Email Signature', '/brand-builder': 'Brand Builder',
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

  const topRoutes: Record<string, string> = {
    '/invoices': 'All Invoices', '/financials': 'Financials', '/settings': 'Settings',
    '/brand-kit': 'Agency Brand Kit', '/war-room': 'War Room',
  };
  crumbs.push({ label: topRoutes[pathname] || pathname.slice(1) });
  return crumbs;
}
