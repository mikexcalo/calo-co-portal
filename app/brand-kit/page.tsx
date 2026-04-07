'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/lib/theme';
import { DB, loadClients, loadAllBrandKits } from '@/lib/database';
import { getClientAvatarUrl } from '@/lib/clientAvatar';

export default function BrandKitPage() {
  const { t } = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      if (DB.clientsState !== 'loaded') await loadClients();
      if (!DB.clients.some((c: any) => c.brandKit?._id)) await loadAllBrandKits();
      setClients(DB.clients);
      setLoading(false);
    })();
  }, []);

  if (loading) return null;

  const getSummary = (client: any) => {
    const bk = client.brandKit;
    if (!bk) return 'Not started';
    const parts: string[] = [];
    const logoCount = ['color', 'light', 'dark', 'icon', 'favicon']
      .reduce((n, slot) => n + ((bk.logos as any)?.[slot]?.length || 0), 0);
    if (logoCount > 0) parts.push(`${logoCount} logo${logoCount > 1 ? 's' : ''}`);
    if (bk.colors?.length) parts.push(`${bk.colors.length} color${bk.colors.length > 1 ? 's' : ''}`);
    if (bk.fonts?.heading || bk.fonts?.body) parts.push('fonts');
    return parts.length ? parts.join(' · ') : 'Started';
  };

  return (
    <div style={{ padding: '32px 28px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 400, color: t.text.primary, marginBottom: 4 }}>Brand Kit</h1>
      <p style={{ fontSize: 14, color: t.text.secondary, marginBottom: 28 }}>Manage brand identity for each client</p>

      {/* Agency card */}
      <div onClick={() => router.push('/agency/brand-kit')}
        style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', marginBottom: 12, background: t.bg.surface, border: `0.5px solid ${t.border.default}`, borderRadius: 10, cursor: 'pointer', transition: 'border-color 150ms' }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = t.border.hover)}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = t.border.default)}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: t.bg.surfaceHover, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.text.tertiary} strokeWidth="1.3">
            <circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/>
            <line x1="12" y1="3.5" x2="12" y2="9"/><line x1="12" y1="15" x2="12" y2="20.5"/>
            <line x1="3.5" y1="12" x2="9" y2="12"/><line x1="15" y1="12" x2="20.5" y2="12"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: t.text.primary }}>Agency</div>
          <div style={{ fontSize: 12, color: t.text.secondary }}>MANIFEST brand assets</div>
        </div>
        <svg style={{ marginLeft: 'auto', color: t.text.tertiary }} width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 4l4 4-4 4"/></svg>
      </div>

      {/* Client cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {clients.map(client => {
          const avatar = getClientAvatarUrl(client);
          return (
            <div key={client.id} onClick={() => router.push(`/clients/${client.id}/brand-kit`)}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', background: t.bg.surface, border: `0.5px solid ${t.border.default}`, borderRadius: 10, cursor: 'pointer', transition: 'border-color 150ms' }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = t.border.hover)}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = t.border.default)}>
              <div style={{ width: 36, height: 36, borderRadius: 8, overflow: 'hidden', background: t.bg.surfaceHover, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: t.text.secondary, flexShrink: 0 }}>
                {avatar ? <img src={avatar} alt="" style={{ width: 36, height: 36, objectFit: 'contain' }} /> : (client.company || client.name || '').charAt(0)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: t.text.primary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{client.company || client.name}</div>
                <div style={{ fontSize: 12, color: t.text.secondary }}>{getSummary(client)}</div>
              </div>
              <svg style={{ flexShrink: 0, color: t.text.tertiary }} width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 4l4 4-4 4"/></svg>
            </div>
          );
        })}
      </div>
    </div>
  );
}
