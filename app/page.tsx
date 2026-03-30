'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  initSupabase, initAgency, loadClients, loadInvoices, loadContacts,
  loadAllBrandKits, loadActivityLog, loadExpenses, loadAgencySettings, DB,
} from '@/lib/database';
import { agencyStats, currency } from '@/lib/utils';
import ClientCard, { getClientHealth } from '@/components/dashboard/ClientCard';
import TasksNotesFeed from '@/components/dashboard/TasksNotesFeed';
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
  const [feedKey, setFeedKey] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        await initSupabase();
        await initAgency();
        if (DB.clientsState !== 'loaded') await loadClients();
        await Promise.allSettled(DB.clients.flatMap((c) => [loadInvoices(c.id), loadContacts(c.id)]));
        await loadAllBrandKits();
        await loadActivityLog();
        await loadExpenses().catch(() => {});
        await loadAgencySettings().catch(() => {});
        setStats(agencyStats(DB.invoices, DB.clients));
      } catch (e) { console.error('Init error:', e); }
      finally { setIsLoading(false); }
    };
    init();
  }, []);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const h = now.getHours();
      const tod = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
      setGreeting(`Good ${tod}, Mike`);
      setDateline(now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }));
      setTimeLine(now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }));
    };
    tick();
    const iv = setInterval(tick, 60000);
    return () => clearInterval(iv);
  }, []);

  if (isLoading) return <div className="page" style={{ opacity: 0.5, fontSize: 13, color: '#64748b' }}>Loading dashboard…</div>;

  const filterBucket = (s: string) => s === 'paused' ? 'paused' : s === 'closed' ? 'closed' : 'active';
  const bucketCounts = {
    active: DB.clients.filter((c) => filterBucket(c.engagementStatus) === 'active').length,
    paused: DB.clients.filter((c) => filterBucket(c.engagementStatus) === 'paused').length,
    closed: DB.clients.filter((c) => filterBucket(c.engagementStatus) === 'closed').length,
  };
  const filterLabels: Record<string, string> = { active: 'Active', paused: 'Paused', closed: 'Archived' };
  const searchLower = search.toLowerCase();
  const healthOrder = (c: string) => c === '#ef4444' ? 0 : c === '#f59e0b' ? 1 : 2;

  const filteredClients = DB.clients
    .filter((c) => filterBucket(c.engagementStatus) === clientFilter)
    .filter((c) => {
      if (!searchLower) return true;
      const ct = DB.contacts[c.id] || [];
      const p = ct.find((x) => x.isPrimary) || ct[0];
      return (c.company || c.name || '').toLowerCase().includes(searchLower)
        || (p?.name || '').toLowerCase().includes(searchLower);
    })
    .sort((a, b) => {
      const d = healthOrder(getClientHealth(a).color) - healthOrder(getClientHealth(b).color);
      return d !== 0 ? d : (a.company || a.name).localeCompare(b.company || b.name);
    });

  return (
    <div className="page">
      {/* Two-column layout */}
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>

        {/* LEFT COLUMN (~65%) */}
        <div style={{ flex: '1 1 0', minWidth: 0 }}>
          {/* Greeting */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1f2e', marginBottom: 3 }}>{greeting}</div>
            <div style={{ fontSize: 12.5, color: '#94a3b8' }}>{dateline}{timeLine ? ` · ${timeLine}` : ''}</div>
          </div>

          {/* AI bar — contained to left column */}
          <CommandBar onItemSaved={() => setFeedKey((k) => k + 1)} />

          {/* CLIENTS header + filter tabs + search */}
          <div className="section-title" style={{ marginBottom: 8 }}>Clients</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            {(['active', 'paused', 'closed'] as const).map((s) => (
              <button key={s} onClick={() => setClientFilter(s)} style={{
                padding: '6px 12px', fontSize: 12, fontWeight: 600,
                border: clientFilter === s ? '1.5px solid #2563eb' : '1.5px solid #d1d5db',
                borderRadius: 8, cursor: 'pointer',
                background: clientFilter === s ? '#eff6ff' : '#fff',
                color: clientFilter === s ? '#2563eb' : '#64748b', fontFamily: 'Inter, sans-serif',
              }}>
                {filterLabels[s]} ({bucketCounts[s as keyof typeof bucketCounts]})
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <div style={{ position: 'relative' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"
                style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..." style={{
                  padding: '6px 10px 6px 28px', fontSize: 12, border: '1px solid #e2e8f0',
                  borderRadius: 8, fontFamily: 'Inter, sans-serif', color: '#1a1f2e', width: 160,
                }} />
            </div>
          </div>

          {/* 2-column client tile grid (#7: equal height via align-items stretch) */}
          {DB.clientsState === 'loading' ? (
            <div style={{ opacity: 0.5, fontSize: 13, color: '#64748b' }}>Loading clients…</div>
          ) : DB.clientsState === 'error' ? (
            <div style={{ fontSize: 13, color: '#dc2626' }}>Unable to load clients</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, alignItems: 'stretch' }}>
              {filteredClients.map((client) => (
                <ClientCard
                  key={client.id}
                  client={client}
                  expanded={expandedId === client.id}
                  onToggle={() => setExpandedId(expandedId === client.id ? null : client.id)}
                  onNavigate={() => {
                    localStorage.setItem(`client_accessed_${client.id}`, String(Date.now()));
                    router.push(`/clients/${client.id}`);
                  }}
                />
              ))}
              {/* + Add Client */}
              <div onClick={() => router.push('/clients/new')} style={{
                border: '2px dashed #d1d5db', borderRadius: 10, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: 20, gap: 4, transition: 'border-color 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#2563eb')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#d1d5db')}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>Add Client</span>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN (~35%) */}
        <div style={{ flex: '0 0 300px', width: 300, minWidth: 0 }}>
          {/* OVERVIEW stat card — vertical */}
          <div className="section-title" style={{ marginBottom: 8 }}>Overview</div>
          <div style={{
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
            padding: '14px 16px', marginBottom: 16,
          }}>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Outstanding</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: stats.outstanding > 0 ? '#d97706' : '#1a1f2e' }}>{currency(stats.outstanding)}</div>
            </div>
            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 10 }}>
              <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Paid</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1f2e' }}>{currency(stats.paid)}</div>
            </div>
            <button onClick={() => router.push('/financials')} style={{
              marginTop: 12, background: 'none', border: 'none', color: '#2563eb', fontSize: 12,
              fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif', padding: 0,
            }}>Financials →</button>
          </div>

          {/* NOTES & TASKS feed */}
          <TasksNotesFeed refreshKey={feedKey} />
        </div>
      </div>
    </div>
  );
}
