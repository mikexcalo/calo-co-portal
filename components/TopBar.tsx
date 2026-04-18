'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { DB } from '@/lib/database';
import { useTheme } from '@/lib/theme';

export default function TopBar() {
  const pathname = usePathname();
  const { theme, setTheme, t } = useTheme();
  const router = useRouter();
  const [avatar, setAvatar] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const h = (e: MouseEvent) => { if (searchRef.current && !searchRef.current.contains(e.target as Node) && searchResult) { setSearchResult(null); setSearchQuery(''); } };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [searchResult]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true); setSearchResult(null);
    try {
      const resp = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: searchQuery }) });
      const data = await resp.json();
      setSearchResult(data.answer || data.content || 'No results found.');
    } catch { setSearchResult('Search failed.'); }
    finally { setSearchLoading(false); }
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

      {/* Right: search + toggle + avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div ref={searchRef} style={{ position: 'relative', width: 240 }}>
          <input
            style={{ width: '100%', height: 36, background: t.bg.surface, border: `0.5px solid ${searchLoading || searchResult ? t.accent.primary : t.border.default}`, borderRadius: 8, padding: '0 10px 0 32px', fontSize: 13, color: t.text.primary, outline: 'none', fontFamily: 'inherit', transition: 'border-color 150ms', boxSizing: 'border-box' as const }}
            placeholder="Search Helm..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); if (e.key === 'Escape') { setSearchResult(null); setSearchQuery(''); } }}
          />
          <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="13" height="13" viewBox="0 0 16 16" fill="none" stroke={t.text.secondary} strokeWidth="1.5">
            <circle cx="6.5" cy="6.5" r="5"/><line x1="10" y1="10" x2="14.5" y2="14.5"/>
          </svg>
          {(searchLoading || searchResult) && (
            <div style={{ position: 'absolute', top: '100%', right: 0, width: 320, marginTop: 8, background: t.bg.surface, borderRadius: 10, padding: 16, border: `0.5px solid ${t.border.default}`, boxShadow: t.shadow.elevated, zIndex: 10 }}>
              {searchLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ position: 'relative', width: 8, height: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563eb' }} />
                    <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#2563eb', animation: 'beacon-ping 1.8s ease-out infinite' }} />
                  </div>
                  <span style={{ fontSize: 12, color: t.text.tertiary }}>Searching...</span>
                </div>
              ) : (
                <div style={{ animation: 'fade-in-up 300ms ease-out', position: 'relative' }}>
                  <button onClick={() => { setSearchResult(null); setSearchQuery(''); }}
                    style={{ position: 'absolute', top: -4, right: -4, width: 20, height: 20, borderRadius: '50%', background: t.bg.surfaceHover, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.text.tertiary, fontSize: 14, lineHeight: 1, padding: 0 }}
                    title="Dismiss">×</button>
                  <div style={{ fontSize: 13, color: t.text.primary, lineHeight: 1.5, paddingRight: 20 }}>{searchResult}</div>
                </div>
              )}
            </div>
          )}
        </div>
        <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} style={{
          width: 32, height: 32, border: 'none', borderRadius: 6, background: 'transparent',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: t.text.tertiary, transition: 'color 150ms',
        }}
        onMouseEnter={(e) => e.currentTarget.style.color = t.text.primary}
        onMouseLeave={(e) => e.currentTarget.style.color = t.text.tertiary}>
          {theme === 'dark'
            ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="8" cy="8" r="3"/><line x1="8" y1="1" x2="8" y2="3"/><line x1="8" y1="13" x2="8" y2="15"/><line x1="1" y1="8" x2="3" y2="8"/><line x1="13" y1="8" x2="15" y2="8"/><line x1="3" y1="3" x2="4.4" y2="4.4"/><line x1="11.6" y1="11.6" x2="13" y2="13"/><line x1="3" y1="13" x2="4.4" y2="11.6"/><line x1="11.6" y1="4.4" x2="13" y2="3"/></svg>
            : <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M13.5 8.5a5.5 5.5 0 1 1-6-6 4.5 4.5 0 0 0 6 6z"/></svg>}
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
