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

  if (isLoading) return <div style={{ maxWidth: 960, margin: '0 auto', padding: 24, opacity: 0.5, fontSize: 13, color: '#6b7280' }}>Loading dashboard…</div>;

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

  const getTaskCount = (clientId: string) =>
    allTasks.filter((t) => t.client_id === clientId && t.type === 'task' && t.status === 'open').length;
  const getInvoiceCount = (clientId: string) =>
    DB.invoices.filter((i) => i.clientId === clientId && (i.status === 'unpaid' || i.status === 'overdue')).length;

  const refreshFeed = () => { setFeedKey((k) => k + 1); loadTasksNotes().then(setAllTasks); };

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 24, background: '#fff', minHeight: '100vh' }}>

      {/* ROW 1: Greeting + Financials */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 500, color: '#1a1f2e' }}>{greeting}</div>
          <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>{dateline}{timeLine ? ` · ${timeLine}` : ''}</div>
        </div>
        <div onClick={() => router.push('/financials')} style={{
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
          padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer',
        }}>
          <div>
            <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#9ca3af', fontWeight: 600 }}>Outstanding</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#ba7517' }}>{currency(stats.outstanding)}</div>
          </div>
          <div style={{ width: 1, height: 24, background: '#e5e7eb' }} />
          <div>
            <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#9ca3af', fontWeight: 600 }}>Paid</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#1a1f2e' }}>{currency(stats.paid)}</div>
          </div>
          <span style={{ color: '#9ca3af', fontSize: 16 }}>›</span>
        </div>
      </div>

      {/* ROW 2: AI bar + Priority nudge — same flex ratios as Row 3 */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
        <div style={{ flex: 1.3 }}>
          <CommandBar onItemSaved={refreshFeed} />
        </div>
        <div style={{
          flex: 1, background: '#faeeda', border: '1px solid #f0c97a', borderRadius: 10,
          padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#854f0b" strokeWidth="2" style={{ flexShrink: 0 }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span style={{ fontSize: 12, fontWeight: 500, color: '#854f0b' }}>No priority alerts</span>
        </div>
      </div>

      {/* ROW 3: Two columns — same flex ratios as Row 2 */}
      <div style={{ display: 'flex', gap: 24 }}>
        {/* LEFT: Clients (flex: 1.3) */}
        <div style={{ flex: 1.3, minWidth: 0 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9ca3af' }}>Clients</span>
            <div style={{ flex: 1 }} />
            <div style={{ position: 'relative' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"
                style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..." style={{
                  padding: '6px 10px 6px 28px', fontSize: 12, border: 'none',
                  borderRadius: 6, fontFamily: 'Inter, sans-serif', color: '#1a1f2e', width: 140,
                  background: '#f4f5f7', outline: 'none',
                }} />
            </div>
            <button onClick={() => router.push('/clients/new')} style={{
              background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6,
              padding: '6px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            }}>+ Add</button>
          </div>

          {/* Client tiles */}
          {DB.clientsState === 'loading' ? (
            <div style={{ opacity: 0.5, fontSize: 13, color: '#6b7280' }}>Loading clients…</div>
          ) : DB.clientsState === 'error' ? (
            <div style={{ fontSize: 13, color: '#dc2626' }}>Unable to load clients</div>
          ) : filteredClients.length === 0 ? (
            <div style={{ color: '#9ca3af', fontSize: 13, padding: '12px 0' }}>
              {search ? 'No matching clients.' : 'No clients yet.'}
            </div>
          ) : (
            filteredClients.map((client) => (
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
            ))
          )}
        </div>

        {/* RIGHT: Action Items + Recent Activity (flex: 1) */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <TasksNotesFeed refreshKey={feedKey} />
        </div>
      </div>
    </div>
  );
}
