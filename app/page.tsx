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
import { agencyStats, currency, daysUntil } from '@/lib/utils';
import ClientCard, { getClientHealth } from '@/components/dashboard/ClientCard';
import ActivityFeed from '@/components/dashboard/ActivityFeed';
import CommandBar from '@/components/dashboard/CommandBar';

export default function Home() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [greeting, setGreeting] = useState('Good morning');
  const [dateline, setDateline] = useState('');
  const [timeLine, setTimeLine] = useState('');
  const [clientFilter, setClientFilter] = useState<'active' | 'paused' | 'closed'>('active');
  const [stats, setStats] = useState(agencyStats([], []));
  const [search, setSearch] = useState('');

  useEffect(() => {
    const init = async () => {
      try {
        await initSupabase();
        await initAgency();
        if (DB.clientsState !== 'loaded') await loadClients();
        await Promise.allSettled(
          DB.clients.flatMap((c) => [loadInvoices(c.id), loadContacts(c.id)])
        );
        await loadAllBrandKits();
        await loadActivityLog();
        await loadExpenses().catch(() => {});
        await loadAgencySettings().catch(() => {});
        setStats(agencyStats(DB.invoices, DB.clients));
      } catch (error) {
        console.error('Initialization error:', error);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const hour = now.getHours();
      const tod = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
      setGreeting(`Good ${tod}, Mike`);
      setDateline(now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }));
      setTimeLine(now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }));
    };
    updateClock();
    const interval = setInterval(updateClock, 60000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return <div className="page" style={{ opacity: 0.5, fontSize: 13, color: '#64748b' }}>Loading dashboard…</div>;
  }

  const overdue = DB.invoices.filter((i) => i.status !== 'paid' && !i.isReimbursement && daysUntil(i.due)! < 0);
  const dueSoon = DB.invoices.filter((i) => i.status !== 'paid' && !i.isReimbursement && daysUntil(i.due)! >= 0 && daysUntil(i.due)! <= 7);

  const filterBucket = (status: string) => status === 'paused' ? 'paused' : status === 'closed' ? 'closed' : 'active';
  const bucketCounts = {
    active: DB.clients.filter((c) => filterBucket(c.engagementStatus) === 'active').length,
    paused: DB.clients.filter((c) => filterBucket(c.engagementStatus) === 'paused').length,
    closed: DB.clients.filter((c) => filterBucket(c.engagementStatus) === 'closed').length,
  };
  const filterLabels = { active: 'Active', paused: 'Paused', closed: 'Archived' };

  // Sort by health: red first, orange middle, green last. Within tier, alphabetical.
  const healthOrder = (color: string) => color === '#ef4444' ? 0 : color === '#f59e0b' ? 1 : 2;
  const searchLower = search.toLowerCase();

  const filteredClients = DB.clients
    .filter((c) => filterBucket(c.engagementStatus) === clientFilter)
    .filter((c) => {
      if (!searchLower) return true;
      const contacts = DB.contacts[c.id] || [];
      const primary = contacts.find((ct) => ct.isPrimary) || contacts[0];
      return (c.company || c.name || '').toLowerCase().includes(searchLower)
        || (primary?.name || '').toLowerCase().includes(searchLower);
    })
    .sort((a, b) => {
      const ha = getClientHealth(a);
      const hb = getClientHealth(b);
      const diff = healthOrder(ha.color) - healthOrder(hb.color);
      if (diff !== 0) return diff;
      return (a.company || a.name).localeCompare(b.company || b.name);
    });

  // Next Action banner (#10)
  let nextAction: { icon: string; text: string } | null = null;
  for (const c of DB.clients) {
    const h = getClientHealth(c);
    if (h.color === '#ef4444' && h.issues.length > 0) {
      nextAction = { icon: '⚠️', text: `${c.company || c.name} needs attention — missing ${h.issues[0].label}` };
      break;
    }
  }
  if (!nextAction) {
    for (const c of DB.clients) {
      const h = getClientHealth(c);
      if (h.color === '#f59e0b' && h.issues.length > 0) {
        nextAction = { icon: '📋', text: `${c.company || c.name} is almost complete — finish ${h.issues[0].label}` };
        break;
      }
    }
  }
  if (!nextAction && DB.clients.length > 0) {
    nextAction = { icon: '✅', text: 'All clients looking good' };
  }

  return (
    <div className="page">
      {/* Greeting — no summary line (#1) */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1f2e', marginBottom: 3 }}>{greeting}</div>
        <div style={{ fontSize: 12.5, color: '#94a3b8' }}>
          {dateline}{timeLine ? ` · ${timeLine}` : ''}
        </div>
      </div>

      {/* Command bar */}
      <CommandBar />

      {/* Attention strip */}
      {(overdue.length > 0 || dueSoon.length > 0) && (
        <div className="attn-strip" style={{ marginBottom: 18 }}>
          <span className="attn-label">⚠ Needs attention</span>
          {overdue.map((inv) => (
            <div key={inv.id} className="attn-item" onClick={() => router.push(`/clients/${inv.clientId}?invoiceId=${inv.id}`)} style={{ cursor: 'pointer' }}>
              <span className="attn-dot red" />
              <span className="attn-item-text">#{inv.id} — {DB.clients.find((c) => c.id === inv.clientId)?.company || 'Unknown'}</span>
              <span className="attn-item-sub">overdue {Math.abs(daysUntil(inv.due)!)}d</span>
            </div>
          ))}
          {dueSoon.map((inv) => (
            <div key={inv.id} className="attn-item" onClick={() => router.push(`/clients/${inv.clientId}?invoiceId=${inv.id}`)} style={{ cursor: 'pointer' }}>
              <span className="attn-dot amber" />
              <span className="attn-item-text">#{inv.id} — {DB.clients.find((c) => c.id === inv.clientId)?.company || 'Unknown'}</span>
              <span className="attn-item-sub">due in {daysUntil(inv.due)!}d</span>
            </div>
          ))}
        </div>
      )}

      {/* Two-column layout */}
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {/* Left: overview + clients */}
        <div style={{ flex: '1 1 0', minWidth: 0 }}>
          {/* OVERVIEW label (#2) */}
          <div className="section-title" style={{ marginBottom: 8 }}>Overview</div>
          {/* Stat bar */}
          <div style={{
            display: 'flex', gap: 20, padding: '10px 14px', marginBottom: 12,
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
            fontSize: 13, color: '#334155', alignItems: 'center',
          }}>
            <div>
              <span style={{ fontWeight: 700, fontSize: 16, color: stats.outstanding > 0 ? '#d97706' : '#1a1f2e' }}>
                {currency(stats.outstanding)}
              </span>
              <span style={{ color: '#94a3b8', marginLeft: 5, fontSize: 12 }}>outstanding</span>
            </div>
            <div style={{ width: 1, height: 24, background: '#e2e8f0' }} />
            <div>
              <span style={{ fontWeight: 700, fontSize: 16, color: '#1a1f2e' }}>{currency(stats.paid)}</span>
              <span style={{ color: '#94a3b8', marginLeft: 5, fontSize: 12 }}>paid</span>
            </div>
            <div style={{ width: 1, height: 24, background: '#e2e8f0' }} />
            <div>
              <span style={{ fontWeight: 700, fontSize: 16, color: '#1a1f2e' }}>{bucketCounts.active}</span>
              <span style={{ color: '#94a3b8', marginLeft: 5, fontSize: 12 }}>active</span>
            </div>
            <div style={{ flex: 1 }} />
            <button onClick={() => router.push('/financials')} style={{
              background: 'none', border: 'none', color: '#2563eb', fontSize: 11,
              fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            }}>Financials →</button>
          </div>

          {/* Next Action banner (#10) */}
          {nextAction && (
            <div style={{
              padding: '8px 14px', marginBottom: 14, borderRadius: 8,
              background: nextAction.icon === '✅' ? '#f0fdf4' : nextAction.icon === '⚠️' ? '#fef2f2' : '#fffbeb',
              border: `1px solid ${nextAction.icon === '✅' ? '#bbf7d0' : nextAction.icon === '⚠️' ? '#fecaca' : '#fde68a'}`,
              fontSize: 12, color: '#334155', fontFamily: 'Inter, sans-serif',
            }}>
              {nextAction.icon} {nextAction.text}
            </div>
          )}

          {/* CLIENTS header + filters + search */}
          <div style={{ marginBottom: 10 }}>
            <div className="section-title" style={{ marginBottom: 8 }}>Clients</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <button className="cta-btn" onClick={() => router.push('/clients/new')}>+ Add Client</button>
              {(['active', 'paused', 'closed'] as const).map((status) => (
                <button key={status} onClick={() => setClientFilter(status)} style={{
                  padding: '7px 13px', fontSize: 12, fontWeight: 600,
                  border: clientFilter === status ? '1.5px solid #2563eb' : '1.5px solid #d1d5db',
                  borderRadius: 8, cursor: 'pointer',
                  background: clientFilter === status ? '#eff6ff' : '#fff',
                  color: clientFilter === status ? '#2563eb' : '#64748b',
                  fontFamily: 'Inter, sans-serif',
                }}>
                  {filterLabels[status]} ({bucketCounts[status]})
                </button>
              ))}
            </div>
            {/* Search bar (#9) */}
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clients..."
              style={{
                width: '100%', padding: '7px 12px', fontSize: 13, border: '1px solid #e2e8f0',
                borderRadius: 8, fontFamily: 'Inter, sans-serif', color: '#1a1f2e',
              }}
            />
          </div>

          {/* Client list */}
          {DB.clientsState === 'loading' ? (
            <div style={{ opacity: 0.5, padding: '12px 0', fontSize: 13, color: '#64748b' }}>Loading clients…</div>
          ) : DB.clientsState === 'error' ? (
            <div style={{ padding: '12px 0', fontSize: 13, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 10 }}>
              Unable to load clients
              <button className="btn btn-ghost btn-sm" style={{ color: '#6366f1', fontSize: 12, padding: '2px 10px' }}
                onClick={() => window.location.reload()}>↺ Retry</button>
            </div>
          ) : filteredClients.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: 13, padding: '8px 0' }}>
              {search ? 'No matching clients.' : DB.clients.length === 0 ? 'No clients yet — add one above.' : `No ${filterLabels[clientFilter].toLowerCase()} clients.`}
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

        {/* Right: Activity Feed — ACTIVITY header aligns with OVERVIEW (#2) */}
        <div style={{ flex: '0 0 280px', width: 280, minWidth: 0 }}>
          <ActivityFeed />
        </div>
      </div>
    </div>
  );
}
