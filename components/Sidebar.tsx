'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useTheme } from '@/lib/theme';

const icons: Record<string, React.ReactNode> = {
  dashboard: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="1.5" y="1.5" width="5" height="5" rx="1"/><rect x="9.5" y="1.5" width="5" height="5" rx="1"/><rect x="1.5" y="9.5" width="5" height="5" rx="1"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/></svg>,
  invoices: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="2" y="1" width="12" height="14" rx="1.5"/><line x1="5" y1="5" x2="11" y2="5" strokeLinecap="round"/><line x1="5" y1="8" x2="11" y2="8" strokeLinecap="round"/><line x1="5" y1="11" x2="8" y2="11" strokeLinecap="round"/></svg>,
  financials: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="2" y="1" width="12" height="14" rx="1.5"/><line x1="5" y1="11" x2="5" y2="7" strokeLinecap="round"/><line x1="8" y1="11" x2="8" y2="5" strokeLinecap="round"/><line x1="11" y1="11" x2="11" y2="8" strokeLinecap="round"/></svg>,
  brandKit: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="3"/><circle cx="8" cy="8" r="0.8"/></svg>,
  designStudio: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><ellipse cx="7.5" cy="8.5" rx="6.5" ry="5.5"/><circle cx="5" cy="7" r="1" fill="currentColor" stroke="none"/><circle cx="8" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="10.5" cy="8" r="1" fill="currentColor" stroke="none"/><circle cx="4.5" cy="10" r="0.8" fill="none" stroke="currentColor" strokeWidth="1"/></svg>,
  settings: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  yardSign: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="3" y="1.5" width="10" height="8" rx="1"/><line x1="6" y1="9.5" x2="6" y2="14.5" strokeLinecap="round"/><line x1="10" y1="9.5" x2="10" y2="14.5" strokeLinecap="round"/></svg>,
  clients: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="6" cy="5" r="2.5"/><path d="M1.5 14c0-2.5 2-4.5 4.5-4.5s4.5 2 4.5 4.5"/><circle cx="11" cy="4.5" r="2"/><path d="M14.5 13c0-2 1.5-3.5-1.5-3.5"/></svg>,
  sun: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="8" cy="8" r="3"/><line x1="8" y1="1" x2="8" y2="3"/><line x1="8" y1="13" x2="8" y2="15"/><line x1="1" y1="8" x2="3" y2="8"/><line x1="13" y1="8" x2="15" y2="8"/><line x1="3" y1="3" x2="4.4" y2="4.4"/><line x1="11.6" y1="11.6" x2="13" y2="13"/><line x1="3" y1="13" x2="4.4" y2="11.6"/><line x1="11.6" y1="4.4" x2="13" y2="3"/></svg>,
  moon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M13.5 8.5a5.5 5.5 0 1 1-6-6 4.5 4.5 0 0 0 6 6z"/></svg>,
};

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme, t } = useTheme();
  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    if (href === '/clients') return pathname === '/clients';
    return pathname.startsWith(href);
  };

  const navBtn = (label: string, href: string, icon: React.ReactNode) => {
    const active = isActive(href);
    return (
      <button key={label} onClick={() => router.push(href)} style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
        padding: '8px 16px', margin: '1px 0', borderRadius: 6, border: 'none',
        fontSize: 14, color: active ? '#3d3d40' : '#8a8a8e',
        fontWeight: active ? 500 : 400,
        background: active ? (theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)') : 'transparent',
        cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        transition: 'all 150ms',
      }}
      onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'; e.currentTarget.style.color = t.text.primary; }}}
      onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8a8a8e'; }}}
      >
        <span style={{ width: 20, height: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: active ? '#2563eb' : 'inherit' }}>{icon}</span>
        {label}
      </button>
    );
  };

  return (
    <div style={{
      width: 200, flexShrink: 0, background: t.bg.sidebar,
      borderRight: `1px solid ${t.border.default}`,
      display: 'flex', flexDirection: 'column', height: '100vh',
      fontFamily: 'inherit',
    }}>
      {/* Logo + toggle */}
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 2, position: 'relative', flexShrink: 0 }}>
        <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} style={{
          position: 'absolute', top: 12, right: 16, width: 28, height: 28, border: 'none', borderRadius: 6, background: 'transparent',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.text.tertiary, transition: 'color 150ms',
        }}
        onMouseEnter={(e) => e.currentTarget.style.color = t.text.secondary}
        onMouseLeave={(e) => e.currentTarget.style.color = t.text.tertiary}>
          {theme === 'dark' ? icons.sun : icons.moon}
        </button>
        <div onClick={() => router.push('/')} style={{ cursor: 'pointer' }}>
          <div style={{ width: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6b6b6f" strokeWidth="1.3" strokeLinecap="round">
              <circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="3" />
              <line x1="12" y1="3.5" x2="12" y2="9" /><line x1="12" y1="15" x2="12" y2="20.5" />
              <line x1="3.5" y1="12" x2="9" y2="12" /><line x1="15" y1="12" x2="20.5" y2="12" />
              <line x1="5.9" y1="5.9" x2="9.9" y2="9.9" /><line x1="14.1" y1="14.1" x2="18.1" y2="18.1" />
              <line x1="5.9" y1="18.1" x2="9.9" y2="14.1" /><line x1="14.1" y1="9.9" x2="18.1" y2="5.9" />
            </svg>
          </div>
          <span style={{ fontSize: 16, fontWeight: 400, color: '#6b6b6f', letterSpacing: '0.5px', paddingLeft: 30 }}>CALO&CO</span>
        </div>
      </div>

      {/* Nav */}
      <div style={{ flex: 1, padding: '8px 8px', display: 'flex', flexDirection: 'column', gap: 0, overflowY: 'auto' }}>
        {navBtn('Dashboard', '/', icons.dashboard)}
        {navBtn('Clients', '/clients', icons.clients)}
        {navBtn('Invoices', '/invoices', icons.invoices)}
        {navBtn('Financials', '/financials', icons.financials)}
        {navBtn('Brand Kit', '/agency/brand-kit', icons.brandKit)}
        {navBtn('Design Studio', '/agency/design-studio', icons.designStudio)}
        <div style={{ height: 8 }} />
        {navBtn('Settings', '/settings', icons.settings)}
      </div>
      <div style={{ padding: '12px 16px', textAlign: 'center' }}>
        <a href="https://mikecalo.co" target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 9, color: t.text.tertiary, textDecoration: 'none', fontFamily: 'inherit' }}>
          Powered by CALO&CO
        </a>
      </div>
    </div>
  );
}
