'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DB, loadClients, loadContacts, loadInvoices } from '@/lib/database';
import { Client, Contact } from '@/lib/types';
import { useTheme } from '@/lib/theme';
import { invTotal, currency } from '@/lib/utils';
import { getClientAvatarUrl } from '@/lib/clientAvatar';
import { PageShell, PageHeader, StatRow, DataCard, TableHeader, TableRow, TableCell, CtaButton } from '@/components/shared/Brand';

export default function ClientsPage() {
  const router = useRouter();
  const { t } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [contacts, setContacts] = useState<Record<string, Contact[]>>({});
  const [search, setSearch] = useState('');

  useEffect(() => {
    const init = async () => {
      if (DB.clientsState !== 'loaded') await loadClients();
      for (const c of DB.clients) {
        if (!DB.contacts[c.id]) await loadContacts(c.id);
        const hasInv = DB.invoices.some((i) => i.clientId === c.id);
        if (!hasInv) await loadInvoices(c.id).catch(() => {});
      }
      setClients(DB.clients);
      setContacts({ ...DB.contacts });
      setIsLoading(false);
    };
    init();
  }, []);

  if (isLoading) return null;

  const sorted = [...clients].sort((a, b) => (a.company || a.name).localeCompare(b.company || b.name));

  const filtered = search.trim()
    ? sorted.filter((c) => {
        const q = search.toLowerCase();
        const ct = contacts[c.id] || [];
        const primary = ct.find((x) => x.isPrimary) || ct[0];
        return (c.company || c.name || '').toLowerCase().includes(q) || (primary?.name || '').toLowerCase().includes(q);
      })
    : sorted;

  // CRM stats
  const activeCount = clients.filter((c) => (c as any).status === 'active' || !(c as any).status).length;
  const pausedCount = clients.filter((c) => (c as any).status === 'paused').length;
  const totalOutstanding = clients.reduce((sum, c) => {
    const ci = DB.invoices.filter((i) => i.clientId === c.id);
    return sum + ci.filter((i) => i.status !== 'paid').reduce((s, i) => s + invTotal(i), 0);
  }, 0);
  const totalRevenue = clients.reduce((sum, c) => {
    const ci = DB.invoices.filter((i) => i.clientId === c.id);
    return sum + ci.filter((i) => i.status === 'paid').reduce((s, i) => s + invTotal(i), 0);
  }, 0);

  return (
    <PageShell>
      <PageHeader
        title="Clients"
        subtitle={`${clients.length} client${clients.length !== 1 ? 's' : ''}`}
        action={<CtaButton onClick={() => router.push('/clients/new')}>+ Add Client</CtaButton>}
      />

      <StatRow stats={[
        { label: 'Active', value: String(activeCount) },
        { label: 'Paused', value: String(pausedCount), color: pausedCount > 0 ? t.status.warning : undefined },
        { label: 'Outstanding', value: currency(totalOutstanding), color: totalOutstanding > 0 ? t.status.warning : undefined },
        { label: 'Total revenue', value: currency(totalRevenue), color: totalRevenue > 0 ? t.status.success : undefined },
      ]} />

      {/* Search bar */}
      <div style={{ marginBottom: 16, position: 'relative', maxWidth: 360 }}>
        <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={t.text.tertiary} strokeWidth="1.5">
          <circle cx="6.5" cy="6.5" r="5"/><line x1="10" y1="10" x2="14.5" y2="14.5"/>
        </svg>
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search clients..."
          style={{ width: '100%', background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 8, padding: '9px 12px 9px 36px', fontSize: 13, color: t.text.primary, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const, transition: 'border-color 150ms' }}
          onFocus={(e) => { e.currentTarget.style.borderColor = '#2563eb'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = t.border.default; }}
        />
      </div>

      {/* Client table */}
      <DataCard noPadding>
        <TableHeader columns={[
          { label: '', flex: 0.3 },
          { label: 'Company', flex: 2 },
          { label: 'Contact', flex: 1.5 },
          { label: 'Phone', flex: 1.2 },
          { label: 'Status', flex: 0.8 },
          { label: 'Outstanding', flex: 1, align: 'right' },
          { label: 'Revenue', flex: 1, align: 'right' },
          { label: '', flex: 0.3 },
        ]} />

        {filtered.map((client) => {
          const avatar = getClientAvatarUrl(client);
          const ct = contacts[client.id] || [];
          const primary = ct.find((c) => c.isPrimary) || ct[0];
          const clientInvs = DB.invoices.filter((i) => i.clientId === client.id);
          const outstanding = clientInvs.filter((i) => i.status !== 'paid').reduce((s, i) => s + invTotal(i), 0);
          const revenue = clientInvs.filter((i) => i.status === 'paid').reduce((s, i) => s + invTotal(i), 0);
          const status = (client as any).status || 'active';

          return (
            <TableRow key={client.id} onClick={() => router.push(`/clients/${client.id}`)}>
              {/* Avatar */}
              <div style={{ flex: 0.3, display: 'flex', alignItems: 'center' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, overflow: 'hidden', background: avatar ? 'transparent' : t.bg.surfaceHover, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: t.text.secondary, flexShrink: 0 }}>
                  {avatar
                    ? <img src={avatar} alt="" style={{ width: 32, height: 32, objectFit: 'contain' }} />
                    : (client.company || client.name || '').charAt(0)
                  }
                </div>
              </div>

              {/* Company */}
              <TableCell flex={2} primary>{client.company || client.name}</TableCell>

              {/* Contact */}
              <TableCell flex={1.5}>
                {primary ? (
                  <>
                    {primary.name || '—'}
                    {(primary.title || primary.role) && <span style={{ color: t.text.tertiary, marginLeft: 4 }}>· {primary.title || primary.role}</span>}
                  </>
                ) : '—'}
              </TableCell>

              {/* Phone */}
              <TableCell flex={1.2}>{primary?.phone || '—'}</TableCell>

              {/* Status */}
              <div style={{ flex: 0.8 }}>
                <span style={{
                  fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 4,
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: status === 'active' ? 'rgba(0,201,160,0.08)' : status === 'paused' ? 'rgba(245,158,11,0.08)' : t.bg.surfaceHover,
                  color: status === 'active' ? '#054D3D' : status === 'paused' ? '#b45309' : t.text.secondary,
                }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </span>
              </div>

              {/* Outstanding */}
              <TableCell flex={1} align="right">
                <span style={{ color: outstanding > 0 ? t.status.warning : t.text.secondary }}>
                  {currency(outstanding)}
                </span>
              </TableCell>

              {/* Revenue */}
              <TableCell flex={1} align="right">
                <span style={{ color: revenue > 0 ? t.status.success : t.text.secondary }}>
                  {currency(revenue)}
                </span>
              </TableCell>

              {/* Chevron */}
              <div style={{ flex: 0.3, display: 'flex', justifyContent: 'flex-end' }}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke={t.text.tertiary} strokeWidth="1.5"><path d="M6 4l4 4-4 4"/></svg>
              </div>
            </TableRow>
          );
        })}

        {filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: t.text.tertiary, fontSize: 13 }}>
            {search ? `No clients match "${search}"` : 'No clients yet'}
          </div>
        )}
      </DataCard>
    </PageShell>
  );
}
