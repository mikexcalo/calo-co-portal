'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DB, loadClients, loadContacts, loadInvoices, loadAllBrandKits } from '@/lib/database';
import { Client, Contact } from '@/lib/types';
import { useTheme } from '@/lib/theme';
import { invTotal, currency, formatPhone } from '@/lib/utils';
import { getClientAvatarUrl } from '@/lib/clientAvatar';
import { PageShell, PageHeader, StatRow, DataCard, TableHeader, TableRow, TableCell, CtaButton } from '@/components/shared/Brand';
import { StatusPill } from '@/components/shared/StatusPill';

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
      if (!DB.clients.some((c) => c.brandKit?._id)) await loadAllBrandKits();
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

  // Health stats
  const activeCount = clients.filter((c) => (c as any).engagementStatus === 'active' || !(c as any).engagementStatus).length;
  const pausedCount = clients.filter((c) => (c as any).engagementStatus === 'paused').length;
  const needsAttentionCount = clients.filter((c) => {
    const ci = DB.invoices.filter((i) => i.clientId === c.id);
    const hasOverdue = ci.some(i => i.status === 'overdue');
    const hasOldDraft = ci.some(i => {
      if (i.status !== 'draft') return false;
      const created = (i as any).created_at || (i as any).date;
      if (!created) return false;
      return (Date.now() - new Date(created).getTime()) > 14 * 86400000;
    });
    return hasOverdue || hasOldDraft;
  }).length;

  return (
    <PageShell>
      <PageHeader
        title="Clients"
        subtitle={`${clients.length} client${clients.length !== 1 ? 's' : ''}`}
        action={<CtaButton onClick={() => router.push('/clients/new')}>+ Add Client</CtaButton>}
      />

      <StatRow stats={[
        { label: 'Total clients', value: String(clients.length) },
        { label: 'Active', value: String(activeCount) },
        { label: 'Paused', value: String(pausedCount), color: pausedCount > 0 ? '#F59E0B' : undefined },
        { label: 'Needs attention', value: String(needsAttentionCount), color: needsAttentionCount > 0 ? '#DC2626' : undefined },
      ]} />

      {/* Search bar */}
      <div style={{ marginBottom: 24, position: 'relative', maxWidth: 360 }}>
        <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={t.text.tertiary} strokeWidth="1.5">
          <circle cx="6.5" cy="6.5" r="5"/><line x1="10" y1="10" x2="14.5" y2="14.5"/>
        </svg>
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search clients..."
          style={{ width: '100%', background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 8, padding: '9px 12px 9px 36px', fontSize: 13, color: t.text.primary, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const, transition: 'border-color 150ms' }}
          onFocus={(e) => { e.currentTarget.style.borderColor = t.accent.primary; }}
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
          { label: '', flex: 0.3 },
        ]} />

        {filtered.map((client) => {
          const avatar = getClientAvatarUrl(client);
          const ct = contacts[client.id] || [];
          const primary = ct.find((c) => c.isPrimary) || ct[0];
          const clientInvs = DB.invoices.filter((i) => i.clientId === client.id);
          const outstanding = clientInvs.filter((i) => i.status !== 'paid' && i.status !== 'draft').reduce((s, i) => s + invTotal(i), 0);
          const engStatus = ((client as any).engagementStatus || 'active') as 'active' | 'paused' | 'archived';

          return (
            <TableRow key={client.id} onClick={() => router.push(`/clients/${client.id}`)}>
              <div style={{ flex: 0.3, display: 'flex', alignItems: 'center', marginRight: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, overflow: 'hidden', background: avatar ? 'transparent' : t.bg.surfaceHover, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: t.text.secondary, flexShrink: 0 }}>
                  {avatar ? <img src={avatar} alt="" style={{ width: 32, height: 32, objectFit: 'contain' }} /> : (client.company || client.name || '').charAt(0)}
                </div>
              </div>

              <TableCell flex={2} primary>{client.company || client.name}</TableCell>

              <TableCell flex={1.5}>
                {primary ? (
                  <div style={{ minWidth: 0 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{primary.name || '—'}</div>
                    {(primary.title || primary.role) && <div style={{ fontSize: 11, color: t.text.tertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={primary.title || primary.role}>{primary.title || primary.role}</div>}
                  </div>
                ) : '—'}
              </TableCell>

              <TableCell flex={1.2}>{formatPhone(primary?.phone)}</TableCell>

              <div style={{ flex: 0.8 }}>
                <StatusPill status={engStatus} />
              </div>

              <TableCell flex={1} align="right">
                <span style={{ color: outstanding > 0 ? '#DC2626' : t.text.secondary, fontWeight: outstanding > 0 ? 500 : 400 }}>
                  {currency(outstanding)}
                </span>
              </TableCell>

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
