'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { tokens } from '@/lib/design-tokens';

const t = tokens;

const icons: Record<string, React.ReactNode> = {
  dashboard: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="1.5" y="1.5" width="5" height="5" rx="1"/><rect x="9.5" y="1.5" width="5" height="5" rx="1"/><rect x="1.5" y="9.5" width="5" height="5" rx="1"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/></svg>,
  invoices: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="2" y="1" width="12" height="14" rx="1.5"/><line x1="5" y1="5" x2="11" y2="5" strokeLinecap="round"/><line x1="5" y1="8" x2="11" y2="8" strokeLinecap="round"/><line x1="5" y1="11" x2="8" y2="11" strokeLinecap="round"/></svg>,
  financials: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="2" y="1" width="12" height="14" rx="1.5"/><line x1="5" y1="11" x2="5" y2="7" strokeLinecap="round"/><line x1="8" y1="11" x2="8" y2="5" strokeLinecap="round"/><line x1="11" y1="11" x2="11" y2="8" strokeLinecap="round"/></svg>,
  brandKit: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="3"/><circle cx="8" cy="8" r="0.8"/></svg>,
  designStudio: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="1.5" y="1.5" width="13" height="13" rx="1.5"/><line x1="1.5" y1="6" x2="14.5" y2="6"/><line x1="6" y1="6" x2="6" y2="14.5"/></svg>,
  settings: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="8" cy="8" r="2.5"/><path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.1 3.1l1.1 1.1M11.8 11.8l1.1 1.1M3.1 12.9l1.1-1.1M11.8 4.2l1.1-1.1"/></svg>,
  yardSign: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="3" y="1.5" width="10" height="8" rx="1"/><line x1="6" y1="9.5" x2="6" y2="14.5" strokeLinecap="round"/><line x1="10" y1="9.5" x2="10" y2="14.5" strokeLinecap="round"/></svg>,
  clients: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="6" cy="5" r="2.5"/><path d="M1.5 14c0-2.5 2-4.5 4.5-4.5s4.5 2 4.5 4.5"/><circle cx="11" cy="4.5" r="2"/><path d="M14.5 13c0-2 1.5-3.5-1.5-3.5"/></svg>,
};

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [activeAsset, setActiveAsset] = useState<string | null>(null);

  const isBrandBuilder = pathname.includes('/brand-builder') || pathname.includes('/design-studio');
  const clientMatch = pathname.match(/^\/clients\/([^/]+)/);
  const clientId = clientMatch?.[1];

  useEffect(() => {
    const handler = (e: Event) => setActiveAsset((e as CustomEvent).detail || null);
    window.addEventListener('bbAssetTypeChange', handler);
    return () => window.removeEventListener('bbAssetTypeChange', handler);
  }, []);

  useEffect(() => {
    if (!isBrandBuilder) setActiveAsset(null);
  }, [isBrandBuilder]);

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
        padding: '8px 12px', margin: '1px 0', borderRadius: 6, border: 'none',
        borderLeft: active ? `2px solid ${t.accent.primary}` : '2px solid transparent',
        fontSize: 13, color: active ? t.text.primary : t.text.secondary,
        fontWeight: active ? 500 : 400,
        background: 'transparent', cursor: 'pointer',
        fontFamily: 'inherit', textAlign: 'left',
        transition: 'all 150ms',
      }}
      onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = t.bg.surfaceHover; e.currentTarget.style.color = t.text.primary; }}}
      onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = t.text.secondary; }}}
      >
        <span style={{ width: 16, height: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</span>
        {label}
      </button>
    );
  };

  const sectionLabel = (text: string) => (
    <div style={{ fontSize: 10, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.5px', padding: '16px 12px 6px', fontWeight: 500 }}>
      {text}
    </div>
  );

  const assetLabels: Record<string, { label: string; icon: React.ReactNode }> = {
    'yard-sign': { label: 'Yard Signs', icon: icons.yardSign },
    'business-card': { label: 'Business Cards', icon: icons.invoices },
    'vehicle-magnet': { label: 'Vehicle Magnets', icon: icons.invoices },
    't-shirt': { label: 'T-Shirts', icon: icons.invoices },
    'door-hanger': { label: 'Door Hangers', icon: icons.invoices },
    'flyer': { label: 'Flyers', icon: icons.invoices },
  };

  return (
    <div style={{
      width: 200, flexShrink: 0, background: t.bg.sidebar,
      borderRight: `1px solid ${t.border.default}`,
      display: 'flex', flexDirection: 'column', height: '100vh',
      fontFamily: 'inherit',
    }}>
      {/* Logo */}
      <div onClick={() => router.push('/')} style={{
        height: 52, display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 16px', cursor: 'pointer', flexShrink: 0,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, background: '#2563eb',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 14, fontWeight: 700,
        }}>C</div>
        <span style={{ fontSize: 14, fontWeight: 500, color: t.text.primary }}>CALO&CO</span>
      </div>

      {/* Nav */}
      <div style={{ flex: 1, padding: '8px 8px', display: 'flex', flexDirection: 'column', gap: 0, overflowY: 'auto' }}>
        {navBtn('Dashboard', '/', icons.dashboard)}
        {navBtn('Clients', '/clients', icons.clients)}
        {navBtn('Invoices', '/invoices', icons.invoices)}
        {navBtn('Financials', '/financials', icons.financials)}

        {sectionLabel('Agency')}
        {navBtn('Brand Kit', '/agency/brand-kit', icons.brandKit)}
        {navBtn('Design Studio', '/agency/design-studio', icons.designStudio)}

        {clientId && clientId !== 'new' && (
          <>
            {sectionLabel('Client')}
            {navBtn('Brand Kit', `/clients/${clientId}/brand-kit`, icons.brandKit)}
            <button onClick={() => {
              window.dispatchEvent(new CustomEvent('sidebarResetTemplate'));
              router.push(`/clients/${clientId}/brand-builder`);
            }} style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '8px 12px', margin: '1px 0', borderRadius: 6, border: 'none',
              borderLeft: isBrandBuilder ? `2px solid ${t.accent.primary}` : '2px solid transparent',
              fontSize: 13, fontWeight: isBrandBuilder ? 500 : 400,
              color: isBrandBuilder ? t.text.primary : t.text.secondary,
              background: 'transparent', cursor: 'pointer',
              fontFamily: 'inherit', textAlign: 'left' as const,
            }}>
              <span style={{ width: 16, height: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icons.designStudio}</span>
              Design Studio
            </button>

            {isBrandBuilder && activeAsset && assetLabels[activeAsset] && (
              <button style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '7px 12px 7px 32px', margin: '1px 0', borderRadius: 6, border: 'none',
                fontSize: 12, color: t.accent.text, fontWeight: 500,
                background: t.accent.subtle, cursor: 'default',
                fontFamily: 'inherit', textAlign: 'left',
              }}>
                <span style={{ width: 16, height: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {assetLabels[activeAsset].icon}
                </span>
                {assetLabels[activeAsset].label}
              </button>
            )}
          </>
        )}
      </div>

      {/* Settings */}
      <div style={{ borderTop: `1px solid ${t.border.default}`, padding: '8px' }}>
        {navBtn('Settings', '/settings', icons.settings)}
      </div>
    </div>
  );
}
