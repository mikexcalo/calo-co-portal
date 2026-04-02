'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const mainNav = [
  { label: 'Dashboard', href: '/', icon: '⊞' },
  { label: 'Invoices', href: '/invoices', icon: '☰' },
  { label: 'Financials', href: '/financials', icon: '⊡' },
];

const agencyNav = [
  { label: 'Brand Kit', href: '/settings', icon: '◎' },
];

const assetTypes = [
  { id: 'business-card', label: 'Business Cards' },
  { id: 'yard-sign', label: 'Yard Signs' },
  { id: 'vehicle-magnet', label: 'Vehicle Magnets' },
  { id: 't-shirt', label: 'T-Shirts' },
  { id: 'door-hanger', label: 'Door Hangers' },
  { id: 'flyer', label: 'Flyers' },
];

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [activeAsset, setActiveAsset] = useState<string | null>(null);

  const isBrandBuilder = pathname.includes('/brand-builder');

  // Listen for asset type changes from the Brand Builder page
  useEffect(() => {
    const handler = (e: Event) => setActiveAsset((e as CustomEvent).detail || null);
    window.addEventListener('bbAssetTypeChange', handler);
    return () => window.removeEventListener('bbAssetTypeChange', handler);
  }, []);

  // Clear active asset when leaving brand builder
  useEffect(() => {
    if (!isBrandBuilder) setActiveAsset(null);
  }, [isBrandBuilder]);

  const isActive = (href: string) => href === '/' ? pathname === '/' : pathname.startsWith(href);

  const navItem = (item: { label: string; href: string; icon: string }) => {
    const active = isActive(item.href);
    return (
      <button key={item.label} onClick={() => router.push(item.href)} style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
        padding: '8px 12px', margin: '1px 0', borderRadius: 6, border: 'none',
        fontSize: 13, color: active ? '#111827' : '#6b7280', fontWeight: active ? 500 : 400,
        background: active ? '#f3f4f6' : 'transparent', cursor: 'pointer',
        fontFamily: 'Inter, sans-serif', textAlign: 'left',
      }}>
        <span style={{ fontSize: 16, width: 20, textAlign: 'center', opacity: 0.7 }}>{item.icon}</span>
        {item.label}
      </button>
    );
  };

  const handleAssetClick = (assetId: string) => {
    setActiveAsset(assetId);
    // Dispatch event for the Brand Builder page to pick up
    window.dispatchEvent(new CustomEvent('sidebarAssetSelect', { detail: assetId }));
  };

  return (
    <div style={{
      width: 200, flexShrink: 0, background: '#fff',
      borderRight: '0.5px solid rgba(0,0,0,0.08)',
      display: 'flex', flexDirection: 'column', height: '100vh',
      fontFamily: 'Inter, sans-serif',
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
        <span style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>CALO&CO</span>
      </div>

      {/* Main nav */}
      <div style={{ flex: 1, padding: '8px 8px', display: 'flex', flexDirection: 'column', gap: 0, overflowY: 'auto' }}>
        {mainNav.map(navItem)}

        <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '16px 12px 6px', fontWeight: 600 }}>
          Agency
        </div>
        {agencyNav.map(navItem)}

        {/* Design studio assets — only on brand builder pages */}
        {isBrandBuilder && (
          <>
            <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '16px 12px 6px', fontWeight: 600 }}>
              Design studio
            </div>
            {assetTypes.map((t) => {
              const active = activeAsset === t.id;
              return (
                <button key={t.id} onClick={() => handleAssetClick(t.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '8px 12px', margin: '1px 0', borderRadius: 6, border: 'none',
                  fontSize: 13, color: active ? '#111827' : '#6b7280', fontWeight: active ? 500 : 400,
                  background: active ? '#f3f4f6' : 'transparent', cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif', textAlign: 'left',
                }}>
                  {t.label}
                </button>
              );
            })}
          </>
        )}
      </div>

      {/* Settings */}
      <div style={{ borderTop: '0.5px solid rgba(0,0,0,0.08)', padding: '8px' }}>
        <button onClick={() => router.push('/settings')} style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%',
          padding: '8px 12px', borderRadius: 6, border: 'none',
          fontSize: 13, color: '#9ca3af', background: 'transparent', cursor: 'pointer',
          fontFamily: 'Inter, sans-serif', textAlign: 'left',
        }}>
          <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>⚙</span>
          Settings
        </button>
      </div>
    </div>
  );
}
