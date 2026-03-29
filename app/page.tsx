'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  initSupabase,
  initAgency,
  loadClients,
  loadInvoices,
  loadContacts,
  loadAllBrandKits,
  loadActivityLog,
  loadExpenses,
  loadAgencySettings,
  DB,
} from '@/lib/database';
import { agencyStats, currency, daysUntil, invTotal } from '@/lib/utils';
import AgencyToolsTile from '@/components/dashboard/AgencyToolsTile';
import { InvoicesTileHeader, InvoicesTileBody } from '@/components/dashboard/InvoicesTile';
import { FinancialsTileHeader, FinancialsTileBody } from '@/components/dashboard/FinancialsTile';
import { ClientsTileHeader, ClientsTileBody } from '@/components/dashboard/ClientsTile';
import ClientCard from '@/components/dashboard/ClientCard';
import ActivityFeed from '@/components/dashboard/ActivityFeed';

export default function Home() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [greeting, setGreeting] = useState('Good morning');
  const [dateline, setDateline] = useState('');
  const [timeLine, setTimeLine] = useState('');
  const [openTile, setOpenTile] = useState<'invoices' | 'financials' | 'clients' | null>(null);
  const [clientFilter, setClientFilter] = useState<'active' | 'paused' | 'closed'>('active');
  const [stats, setStats] = useState(agencyStats([], []));

  // Initialize app on mount
  useEffect(() => {
    const init = async () => {
      try {
        await initSupabase();
        await initAgency();
        if (DB.clientsState !== 'loaded') await loadClients();

        // Load invoices and contacts for all clients in parallel — don't let any single failure block
        await Promise.allSettled(
          DB.clients.flatMap((c) => [loadInvoices(c.id), loadContacts(c.id)])
        );

        await loadAllBrandKits();
        await loadActivityLog();

        await loadExpenses().catch((e) => console.warn('[init] loadExpenses failed:', e));
        await loadAgencySettings().catch((e) => console.warn('[init] loadAgencySettings failed:', e));

        setStats(agencyStats(DB.invoices, DB.clients));
      } catch (error) {
        console.error('Initialization error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, []);

  // Update greeting and dateline
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const hour = now.getHours();
      const tod = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
      setGreeting(`Hey Mike, good ${tod}!`);

      const options: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      };
      setDateline(now.toLocaleDateString('en-US', options));
      setTimeLine(
        now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      );
    };

    updateClock();
    const interval = setInterval(updateClock, 60000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="page" style={{ opacity: 0.5, fontSize: '13px', color: '#64748b' }}>
        Loading dashboard…
      </div>
    );
  }

  // Get overdue and due-soon invoices
  const overdue = DB.invoices.filter(
    (i) => i.status !== 'paid' && !i.isReimbursement && daysUntil(i.due)! < 0
  );
  const dueSoon = DB.invoices.filter(
    (i) => i.status !== 'paid' && !i.isReimbursement && daysUntil(i.due)! >= 0 && daysUntil(i.due)! <= 7
  );

  // Filter clients by status
  const filterBucket = (status: string) => {
    if (status === 'paused') return 'paused';
    if (status === 'closed') return 'closed';
    return 'active';
  };

  // Sort by most recently accessed (via localStorage timestamps), then alphabetical
  const getLastAccessed = (id: string): number => {
    try {
      return parseInt(localStorage.getItem(`client_accessed_${id}`) || '0', 10);
    } catch { return 0; }
  };

  const filteredClients = DB.clients
    .filter((c) => filterBucket(c.engagementStatus) === clientFilter)
    .sort((a, b) => getLastAccessed(b.id) - getLastAccessed(a.id));

  const bucketCounts = {
    active: DB.clients.filter((c) => filterBucket(c.engagementStatus) === 'active').length,
    paused: DB.clients.filter((c) => filterBucket(c.engagementStatus) === 'paused').length,
    closed: DB.clients.filter((c) => filterBucket(c.engagementStatus) === 'closed').length,
  };

  const filterLabels = { active: 'Active', paused: 'Paused', closed: 'Archived' };

  return (
    <div className="page">
      {/* Greeting */}
      <div style={{ marginBottom: '22px' }}>
        <div style={{ fontSize: '20px', fontWeight: '700', color: '#1a1f2e', marginBottom: '3px' }}>
          {greeting}
        </div>
        <div style={{ fontSize: '12.5px', color: '#94a3b8' }}>
          {dateline}{timeLine ? ` · ${timeLine}` : ''}
        </div>
        <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: 4 }}>
          {bucketCounts.active} active client{bucketCounts.active !== 1 ? 's' : ''}
          {' · '}{currency(stats.outstanding)} outstanding
          {' · '}{DB.invoices.filter((i) => i.status !== 'paid' && !i.isReimbursement).length} invoice{DB.invoices.filter((i) => i.status !== 'paid' && !i.isReimbursement).length !== 1 ? 's' : ''} pending
        </div>
      </div>

      {/* Attention strip */}
      {(overdue.length > 0 || dueSoon.length > 0) && (
        <div className="attn-strip" style={{ marginBottom: '18px' }}>
          <span className="attn-label">⚠ Needs attention</span>
          {overdue.map((inv) => (
            <div
              key={inv.id}
              className="attn-item"
              onClick={() =>
                router.push(`/clients/${inv.clientId}?invoiceId=${inv.id}`)
              }
              style={{ cursor: 'pointer' }}
            >
              <span className="attn-dot red"></span>
              <span className="attn-item-text">
                #{inv.id} — {DB.clients.find((c) => c.id === inv.clientId)?.company || 'Unknown'}
              </span>
              <span className="attn-item-sub">overdue {Math.abs(daysUntil(inv.due)!)}d</span>
            </div>
          ))}
          {dueSoon.map((inv) => (
            <div
              key={inv.id}
              className="attn-item"
              onClick={() =>
                router.push(`/clients/${inv.clientId}?invoiceId=${inv.id}`)
              }
              style={{ cursor: 'pointer' }}
            >
              <span className="attn-dot amber"></span>
              <span className="attn-item-text">
                #{inv.id} — {DB.clients.find((c) => c.id === inv.clientId)?.company || 'Unknown'}
              </span>
              <span className="attn-item-sub">due in {daysUntil(inv.due)!}d</span>
            </div>
          ))}
        </div>
      )}

      {/* Agency Tools Section */}
      <div style={{ marginBottom: '24px' }}>
        <div className="section-hd" style={{ marginBottom: '12px' }}>
          <div className="section-title">Agency Tools</div>
        </div>
        <div className="ag-tools-grid">
          <AgencyToolsTile
            title="Invoices"
            isOpen={openTile === 'invoices'}
            onToggle={() =>
              setOpenTile((prev) => (prev === 'invoices' ? null : 'invoices'))
            }
            headerContent={<InvoicesTileHeader />}
            bodyContent={<InvoicesTileBody />}
          />

          <AgencyToolsTile
            title="Financials"
            isOpen={openTile === 'financials'}
            onToggle={() =>
              setOpenTile((prev) => (prev === 'financials' ? null : 'financials'))
            }
            headerContent={<FinancialsTileHeader />}
            bodyContent={<FinancialsTileBody />}
          />

          <AgencyToolsTile
            title="Clients"
            isOpen={openTile === 'clients'}
            onToggle={() =>
              setOpenTile((prev) => (prev === 'clients' ? null : 'clients'))
            }
            headerContent={<ClientsTileHeader />}
            bodyContent={<ClientsTileBody />}
          />
        </div>
      </div>

      {/* Clients and Activity Feed */}
      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 0', minWidth: 0 }} id="clients-section">
          {/* Clients header with Add + filters */}
          <div style={{ marginBottom: '14px' }}>
            <div className="section-title" style={{ marginBottom: 10 }}>Clients</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button className="cta-btn" onClick={() => router.push('/clients/new')}>
                + Add Client
              </button>
              {(['active', 'paused', 'closed'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setClientFilter(status)}
                  style={{
                    padding: '8px 14px', fontSize: 13, fontWeight: 600,
                    border: clientFilter === status ? '1.5px solid #2563eb' : '1.5px solid #d1d5db',
                    borderRadius: 8, cursor: 'pointer',
                    background: clientFilter === status ? '#eff6ff' : '#ffffff',
                    color: clientFilter === status ? '#2563eb' : '#64748b',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  {filterLabels[status]} ({bucketCounts[status]})
                </button>
              ))}
            </div>
          </div>

          {/* Client grid */}
          {DB.clientsState === 'loading' ? (
            <div style={{ opacity: 0.5, padding: '12px 0', fontSize: '13px', color: '#64748b' }}>
              Loading clients…
            </div>
          ) : DB.clientsState === 'error' ? (
            <div style={{ padding: '12px 0', fontSize: '13px', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '10px' }}>
              Unable to load clients
              <button
                className="btn btn-ghost btn-sm"
                style={{ color: '#6366f1', fontSize: '12px', padding: '2px 10px' }}
                onClick={() => window.location.reload()}
              >
                ↺ Retry
              </button>
            </div>
          ) : DB.clients.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: '13px', padding: '8px 0' }}>
              No clients yet — add one above.
            </div>
          ) : filteredClients.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: '13px', padding: '8px 0' }}>
              No {filterLabels[clientFilter].toLowerCase()} clients.
            </div>
          ) : (
            <div className="cc-list">
              {filteredClients.map((client) => (
                <ClientCard key={client.id} client={client} onNavigate={() => {
                  localStorage.setItem(`client_accessed_${client.id}`, String(Date.now()));
                  router.push(`/clients/${client.id}`);
                }} />
              ))}
            </div>
          )}
        </div>

        {/* Activity Feed */}
        <div style={{ flex: '0 0 280px', width: '280px', minWidth: 0 }}>
          <ActivityFeed />
        </div>
      </div>
    </div>
  );
}
