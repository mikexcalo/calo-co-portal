'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/lib/theme';
import { DB, loadClients, loadAllBrandKits } from '@/lib/database';

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

function computeKitStatus(bk: any, voice?: any): KitStatus {
  const logoKeys = ['color', 'light', 'dark', 'icon'];
  const logoCount = logoKeys.filter(k => bk?.logos?.[k]?.length > 0).length;
  const hasVoice = !!(voice?.elevatorPitch || voice?.tones?.length);
  const hasColors = (bk?.colors?.length || 0) > 0;
  const hasTypography = !!bk?.fonts?.heading;
  const filled = [hasVoice, logoCount > 0, hasColors, hasTypography].filter(Boolean).length;
  if (filled === 0) return 'empty';
  if (hasVoice && logoCount === 4 && hasColors && hasTypography) return 'complete';
  return 'in_progress';
}

export default function BrandKitLayout({ selectedKitId, children }: BrandKitLayoutProps) {
  const { t } = useTheme();
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [agencyKit, setAgencyKit] = useState<KitItem>({ id: 'agency', name: 'CALO&CO', status: 'empty', href: '/brand-kit' });
  const [clients, setClients] = useState<KitItem[]>([]);

  useEffect(() => {
    (async () => {
      try {
        if (DB.clientsState !== 'loaded') await loadClients();
        if (!DB.clients.some((c: any) => c.brandKit?._id)) await loadAllBrandKits();

        setAgencyKit({
          id: 'agency',
          name: DB.agency.name || 'CALO&CO',
          status: computeKitStatus(DB.agency.brandKit),
          href: '/brand-kit',
        });

        setClients(DB.clients.map((c: any) => ({
          id: c.id,
          name: c.company || c.name || 'Client',
          status: computeKitStatus(c.brandKit, c.brand_voice),
          href: `/clients/${c.id}/brand-kit`,
        })));
      } catch (e) {
        console.error('[BrandKitLayout] load error:', e);
      }
      setLoaded(true);
    })();
  }, []);

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

  const SkeletonRow = () => (
    <div style={{ padding: '7px 16px', margin: '2px 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.border.default, flexShrink: 0 }} />
      <span style={{ height: 12, borderRadius: 4, background: t.border.default, flex: 1, maxWidth: 120 }} />
    </div>
  );

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
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ padding: '4px 16px', fontSize: 10, fontWeight: 500, letterSpacing: '0.8px', textTransform: 'uppercase', color: t.text.tertiary, marginTop: 8 }}>
            Your agency
          </div>
          <KitRow kit={agencyKit} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 16px', marginTop: 16 }}>
            <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.8px', textTransform: 'uppercase', color: t.text.tertiary }}>Clients</span>
            {loaded && <span style={{ fontSize: 10, color: t.text.tertiary }}>{clients.length}</span>}
          </div>
          {!loaded ? (
            <>{[1, 2, 3].map(i => <SkeletonRow key={i} />)}</>
          ) : clients.length === 0 ? (
            <div style={{ padding: '8px 24px', fontSize: 12, color: t.text.tertiary }}>No clients yet</div>
          ) : (
            clients.map(c => <KitRow key={c.id} kit={c} />)
          )}

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
