'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  initSupabase, initAgency, loadClients, loadInvoices, loadContacts,
  loadAllBrandKits, loadActivityLog, loadExpenses, loadAgencySettings,
  loadTasksNotes, DB, updateTaskStatus, deleteTaskNote,
} from '@/lib/database';
import { agencyStats, currency } from '@/lib/utils';
import CommandBar from '@/components/dashboard/CommandBar';

function relTime(iso: string): string {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const dy = Math.floor(h / 24);
  return dy === 1 ? '1d' : `${dy}d`;
}

export default function Home() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [greeting, setGreeting] = useState('Good morning');
  const [dateline, setDateline] = useState('');
  const [stats, setStats] = useState(agencyStats([], []));
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
    };
    tick();
    const iv = setInterval(tick, 60000);
    return () => clearInterval(iv);
  }, []);

  if (isLoading) return <div style={{ padding: '32px 40px', opacity: 0.5, fontSize: 13, color: '#6b7280' }}>Loading dashboard…</div>;

  const refreshFeed = () => { setFeedKey((k) => k + 1); loadTasksNotes().then(setAllTasks); };

  // Action items data
  const openTasks = allTasks.filter((t) => t.type === 'task' && t.status === 'open')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const unpaidInvs = DB.invoices.filter((i) => i.status === 'unpaid' || i.status === 'overdue')
    .sort((a, b) => { const da = a.due ? new Date(a.due).getTime() : Infinity; const db = b.due ? new Date(b.due).getTime() : Infinity; return da - db; });

  // Recent activity
  const activityItems = DB.activityLog
    .filter((e) => ['invoice_created', 'invoice_paid', 'client_added', 'task_added', 'note_added'].includes(e.eventType))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 4);
  const evLabels: Record<string, string> = { invoice_created: 'Invoice created', invoice_paid: 'Invoice paid', client_added: 'Client added', task_added: 'Task added', note_added: 'Note added' };

  // Clients
  const clients = DB.clients.sort((a, b) => (a.company || a.name).localeCompare(b.company || b.name));

  return (
    <div style={{ display: 'flex', gap: 24, padding: '32px 40px' }}>

      {/* LEFT COLUMN */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, color: '#111827', margin: '0 0 4px' }}>{greeting}</h1>
        <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 20px' }}>{dateline}</p>

        <CommandBar onItemSaved={refreshFeed} />

        <p style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '24px 0 8px' }}>Action items</p>

        {/* Action item cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {openTasks.map((task) => {
            const cl = DB.clients.find((c) => c.id === task.client_id);
            return (
              <div key={task.id} style={{
                background: '#fff', border: '0.5px solid #e5e7eb', borderLeft: '3px solid #e5e7eb',
                borderRadius: 8, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{ width: 15, height: 15, borderRadius: '50%', background: '#e5e7eb', flexShrink: 0, cursor: 'pointer' }}
                  onClick={async () => { await updateTaskStatus(task.id, 'complete'); refreshFeed(); }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{task.content}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>{cl?.company || cl?.name || ''} · {relTime(task.created_at)}</div>
                </div>
                <span onClick={() => cl && router.push(`/clients/${cl.id}`)} style={{ fontSize: 13, color: '#9ca3af', cursor: 'pointer' }}>→</span>
              </div>
            );
          })}
          {unpaidInvs.map((inv) => {
            const cl = DB.clients.find((c) => c.id === inv.clientId);
            const total = (inv.items || []).reduce((s: number, i: any) => s + (i.qty || 1) * (i.price || 0), 0) + (inv.tax || 0) + (inv.shipping || 0);
            return (
              <div key={inv.id || inv._uuid} style={{
                background: '#fff', border: '0.5px solid #e5e7eb', borderLeft: '3px solid #e5e7eb',
                borderRadius: 8, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
              }} onClick={() => router.push(`/clients/${inv.clientId}/invoices`)}>
                <div style={{ width: 15, height: 15, borderRadius: '50%', background: '#e5e7eb', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>Invoice {inv.id} · {currency(total)}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>{cl?.company || cl?.name || ''}{inv.due ? ` · Due ${inv.due}` : ''}</div>
                </div>
                <span style={{ fontSize: 13, color: '#9ca3af' }}>→</span>
              </div>
            );
          })}
          {openTasks.length === 0 && unpaidInvs.length === 0 && (
            <div style={{ fontSize: 12, color: '#9ca3af', padding: '8px 0' }}>No action items right now.</div>
          )}
        </div>

        {/* Recent activity */}
        {activityItems.length > 0 && (
          <>
            <p style={{ fontSize: 10, color: '#9ca3af', letterSpacing: '0.3px', margin: '24px 0 4px', textTransform: 'uppercase' }}>Recent</p>
            {activityItems.map((ev, idx) => {
              const cl = DB.clients.find((c) => c.id === ev.clientId);
              return (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', padding: '4px 0', fontSize: 11, color: '#9ca3af' }}>
                  <span style={{ flex: 1 }}>
                    {evLabels[ev.eventType] || ev.eventType}
                    {cl && <> · <span style={{ color: '#6b7280', cursor: 'pointer' }} onClick={() => router.push(`/clients/${cl.id}`)}>{cl.company || cl.name} →</span></>}
                  </span>
                  <span style={{ fontSize: 10, color: '#9ca3af', flexShrink: 0 }}>{relTime(ev.createdAt)}</span>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* RIGHT COLUMN */}
      <div style={{ width: 280, flexShrink: 0 }}>
        {/* Financials — two separate cards */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <div onClick={() => router.push('/financials')} style={{
            flex: 1, background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 8, padding: 12, cursor: 'pointer',
          }}>
            <p style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.3px', margin: 0 }}>Outstanding</p>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <p style={{ fontSize: 20, fontWeight: 500, color: '#d97706', margin: '4px 0 0' }}>{currency(stats.outstanding)}</p>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>→</span>
            </div>
          </div>
          <div onClick={() => router.push('/financials')} style={{
            flex: 1, background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 8, padding: 12, cursor: 'pointer',
          }}>
            <p style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.3px', margin: 0 }}>Paid</p>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <p style={{ fontSize: 20, fontWeight: 500, color: '#111827', margin: '4px 0 0' }}>{currency(stats.paid)}</p>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>→</span>
            </div>
          </div>
        </div>

        {/* Clients header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>Clients</p>
          <span onClick={() => router.push('/clients/new')} style={{ fontSize: 12, color: '#2563eb', fontWeight: 500, cursor: 'pointer' }}>+ Add</span>
        </div>

        {/* Client list — compact rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {clients.map((client) => {
            const ct = DB.contacts[client.id] || [];
            const primary = ct.find((c) => c.isPrimary) || ct[0];
            return (
              <div key={client.id} onClick={() => {
                localStorage.setItem(`client_accessed_${client.id}`, String(Date.now()));
                router.push(`/clients/${client.id}`);
              }} style={{
                background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 8,
                padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
              }}>
                {client.logo ? (
                  <img src={client.logo} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 32, height: 32, borderRadius: 6, background: '#f1f3f5', flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client.company || client.name}</div>
                  {primary && <div style={{ fontSize: 11, color: '#9ca3af' }}>{primary.name}</div>}
                </div>
                <span style={{ fontSize: 12, color: '#9ca3af' }}>→</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
