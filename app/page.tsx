'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  initSupabase, initAgency, loadClients, loadInvoices, loadContacts,
  loadAllBrandKits, loadActivityLog, loadExpenses, loadAgencySettings,
  loadTasksNotes, DB,
} from '@/lib/database';
import { agencyStats, currency } from '@/lib/utils';
import ClientCard from '@/components/dashboard/ClientCard';
import TasksNotesFeed from '@/components/dashboard/TasksNotesFeed';
import CommandBar from '@/components/dashboard/CommandBar';

export default function Home() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [greeting, setGreeting] = useState('Good morning');
  const [dateline, setDateline] = useState('');
  const [timeLine, setTimeLine] = useState('');
  const [stats, setStats] = useState(agencyStats([], []));
  const [search, setSearch] = useState('');
  const [feedKey, setFeedKey] = useState(0);
  const [allTasks, setAllTasks] = useState<any[]>([]);

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
        // Load all tasks for pill counts
        const tasks = await loadTasksNotes();
        setAllTasks(tasks);
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

  const searchLower = search.toLowerCase();
  const filteredClients = DB.clients
    .filter((c) => {
      if (!searchLower) return true;
      const ct = DB.contacts[c.id] || [];
      const p = ct.find((x) => x.isPrimary) || ct[0];
      return (c.company || c.name || '').toLowerCase().includes(searchLower)
        || (p?.name || '').toLowerCase().includes(searchLower);
    })
    .sort((a, b) => (a.company || a.name).localeCompare(b.company || b.name));

  // Compute pill counts per client
  const getTaskCount = (clientId: string) =>
    allTasks.filter((t) => t.client_id === clientId && t.type === 'task' && t.status === 'open').length;
  const getInvoiceCount = (clientId: string) =>
    DB.invoices.filter((i) => i.clientId === clientId && (i.status === 'unpaid' || i.status === 'overdue')).length;

  return (
    <div className="page">
      {/* Top row: Greeting (left) + Financials card (right) */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1f2e', marginBottom: 3 }}>{greeting}</div>
          <div style={{ fontSize: 12.5, color: '#94a3b8' }}>{dateline}{timeLine ? ` · ${timeLine}` : ''}</div>
        </div>
        <div onClick={() => router.push('/financials')} style={{
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
          padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 14,
          cursor: 'pointer', flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Outstanding</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: stats.outstanding > 0 ? '#d97706' : '#1a1f2e' }}>{currency(stats.outstanding)}</div>
          </div>
          <div style={{ width: 1, height: 24, background: '#e2e8f0' }} />
          <div>
            <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Paid</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1f2e' }}>{currency(stats.paid)}</div>
          </div>
          <span style={{ color: '#94a3b8', fontSize: 14 }}>›</span>
        </div>
      </div>

      {/* AI bar */}
      <div style={{ marginBottom: 20 }}>
        <CommandBar onItemSaved={() => { setFeedKey((k) => k + 1); loadTasksNotes().then(setAllTasks); }} />
      </div>

      {/* Two-column: Clients (left) + Tasks & Notes (right) */}
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {/* LEFT: CLIENTS */}
        <div style={{ flex: '1 1 0', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div className="section-title">Clients</div>
            <div style={{ flex: 1 }} />
            {/* Search next to Add Client */}
            <div style={{ position: 'relative' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"
                style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..." style={{
                  padding: '5px 10px 5px 26px', fontSize: 12, border: '1px solid #e2e8f0',
                  borderRadius: 6, fontFamily: 'Inter, sans-serif', color: '#1a1f2e', width: 150,
                  background: '#f8fafc',
                }} />
            </div>
            <button className="cta-btn" style={{ height: 30, fontSize: 11, padding: '0 12px' }}
              onClick={() => router.push('/clients/new')}>+ Add Client</button>
          </div>

          {DB.clientsState === 'loading' ? (
            <div style={{ opacity: 0.5, fontSize: 13, color: '#64748b' }}>Loading clients…</div>
          ) : DB.clientsState === 'error' ? (
            <div style={{ fontSize: 13, color: '#dc2626' }}>Unable to load clients</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {filteredClients.map((client) => (
                <ClientCard
                  key={client.id}
                  client={client}
                  taskCount={getTaskCount(client.id)}
                  invoiceCount={getInvoiceCount(client.id)}
                  onNavigate={() => {
                    localStorage.setItem(`client_accessed_${client.id}`, String(Date.now()));
                    router.push(`/clients/${client.id}`);
                  }}
                />
              ))}
              {filteredClients.length === 0 && (
                <div style={{ color: '#94a3b8', fontSize: 13, padding: '8px 0' }}>
                  {search ? 'No matching clients.' : 'No clients yet.'}
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: TASKS & NOTES */}
        <div style={{ flex: '0 0 300px', width: 300, minWidth: 0 }}>
          <TasksNotesFeed refreshKey={feedKey} />
        </div>
      </div>
    </div>
  );
}
