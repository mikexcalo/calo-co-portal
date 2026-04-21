'use client';

import { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/lib/theme';

type KitStatus = 'complete' | 'in_progress' | 'empty';

interface KitItem {
  id: string;
  name: string;
  status: KitStatus;
  href: string;
}

interface BrandKitLayoutProps {
  selectedKitId: string;
  children: ReactNode;
}

export default function BrandKitLayout({ selectedKitId, children }: BrandKitLayoutProps) {
  const { t } = useTheme();
  const router = useRouter();

  // HARDCODED for AT-11a. Wires to real data in AT-11b.
  const agencyKit: KitItem = {
    id: 'agency',
    name: 'CALO&CO',
    status: 'complete',
    href: '/brand-kit',
  };
  const clients: KitItem[] = [
    { id: 'mammoth', name: 'Mammoth Construction', status: 'in_progress', href: '/clients/mammoth/brand-kit' },
    { id: 'lg', name: 'LG Flooring Installation Co.', status: 'in_progress', href: '/clients/lg/brand-kit' },
    { id: 'stevie', name: "Stevie's Poem Store", status: 'empty', href: '/clients/stevie/brand-kit' },
  ];

  const StatusDot = ({ status }: { status: KitStatus }) => {
    if (status === 'complete') {
      return <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.text.primary, flexShrink: 0 }} />;
    }
    if (status === 'in_progress') {
      return <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.text.tertiary, flexShrink: 0 }} />;
    }
    return <span style={{ width: 6, height: 6, borderRadius: '50%', border: `1px solid ${t.text.tertiary}`, background: 'transparent', boxSizing: 'border-box' as const, flexShrink: 0 }} />;
  };

  const KitRow = ({ kit }: { kit: KitItem }) => {
    const selected = kit.id === selectedKitId;
    return (
      <div
        onClick={() => router.push(kit.href)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '7px 16px',
          margin: '2px 8px',
          borderRadius: 6,
          cursor: 'pointer',
          background: selected ? 'rgba(0,106,255,0.08)' : 'transparent',
          transition: 'background 150ms',
        }}
        onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLDivElement).style.background = t.bg.surfaceHover; }}
        onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
      >
        <StatusDot status={kit.status} />
        <span style={{
          fontSize: 13,
          color: selected ? t.text.primary : t.text.secondary,
          fontWeight: selected ? 500 : 400,
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {kit.name}
        </span>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - 56px)', background: t.bg.primary }}>
      <aside style={{
        width: 240,
        flexShrink: 0,
        background: t.bg.surface,
        borderRight: `0.5px solid ${t.border.default}`,
        padding: '16px 0',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{ padding: '0 16px 12px', borderBottom: `0.5px solid ${t.border.default}`, marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: t.text.primary }}>Brand Kit</div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ padding: '4px 16px', fontSize: 10, fontWeight: 500, letterSpacing: '0.8px', textTransform: 'uppercase', color: t.text.tertiary, marginTop: 8 }}>
            Your agency
          </div>
          <KitRow kit={agencyKit} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 16px', marginTop: 16 }}>
            <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.8px', textTransform: 'uppercase', color: t.text.tertiary }}>Clients</span>
            <span style={{ fontSize: 10, color: t.text.tertiary }}>{clients.length}</span>
          </div>
          {clients.map(c => <KitRow key={c.id} kit={c} />)}

          <div style={{ padding: '12px 16px 4px' }}>
            <button
              onClick={() => router.push('/clients')}
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                fontSize: 12,
                color: t.text.secondary,
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <line x1="8" y1="3" x2="8" y2="13"/>
                <line x1="3" y1="8" x2="13" y2="8"/>
              </svg>
              Add client
            </button>
          </div>
        </div>

        <div style={{ padding: '12px 16px 4px', borderTop: `0.5px solid ${t.border.default}`, fontSize: 10, color: t.text.tertiary, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: t.text.primary }} />
            <span>Complete</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: t.text.tertiary }} />
            <span>In progress</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', border: `1px solid ${t.text.tertiary}`, boxSizing: 'border-box' as const }} />
            <span>Empty</span>
          </span>
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
        {children}
      </main>
    </div>
  );
}
