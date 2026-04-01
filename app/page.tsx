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

  function getUrgencyStyle(createdAt: string) {
    const daysSince = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
    if (daysSince >= 3) return {
      background: '#FEF2F2', border: '0.5px solid rgba(252,165,165,0.27)', borderLeft: '3px solid #DC2626',
      titleColor: '#991B1B', subtitleColor: '#B91C1C', arrowColor: '#B91C1C', iconColor: '#DC2626',
      badge: { text: `${daysSince}d`, bg: '#DC2626', color: '#fff' },
    };
    if (daysSince >= 2) return {
      background: '#FFFBEB', border: '0.5px solid rgba(245,158,11,0.2)', borderLeft: '3px solid #F59E0B',
      titleColor: '#92400E', subtitleColor: '#B45309', arrowColor: '#B45309', iconColor: '#D97706',
      badge: { text: `${daysSince}d`, bg: '#F59E0B', color: '#fff' },
    };
    return {
      background: '#ffffff', border: '0.5px solid #e5e7eb', borderLeft: '3px solid #e5e7eb',
      titleColor: '#111827', subtitleColor: '#9ca3af', arrowColor: '#9ca3af', iconColor: '#9ca3af',
      badge: null as null,
    };
  }

  function getActionIcon(content: string, color: string) {
    const t = content.toLowerCase();
    if (t.includes('text ') || t.includes('email ') || t.includes('call ') || t.includes('message'))
      return <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><rect x="1" y="3" width="14" height="10" rx="2" stroke={color} strokeWidth="1.4"/><path d="M1 5l7 4 7-4" stroke={color} strokeWidth="1.4"/></svg>;
    if (t.includes('invoice'))
      return <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><rect x="2" y="1" width="12" height="14" rx="1.5" stroke={color} strokeWidth="1.4"/><path d="M5 5h6M5 8h6M5 11h3" stroke={color} strokeWidth="1.2" strokeLinecap="round"/></svg>;
    return <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><circle cx="8" cy="8" r="6.5" stroke={color} strokeWidth="1.4"/><path d="M8 4.5v4l2.5 1.5" stroke={color} strokeWidth="1.3" strokeLinecap="round"/></svg>;
  }

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
            const u = getUrgencyStyle(task.created_at);
            return (
              <div key={task.id} style={{
                background: u.background, border: u.border, borderLeft: u.borderLeft,
                borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer',
              }} onClick={() => cl && router.push(`/clients/${cl.id}`)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                  <div onClick={async (e) => { e.stopPropagation(); await updateTaskStatus(task.id, 'complete'); refreshFeed(); }} style={{ cursor: 'pointer' }}>
                    {getActionIcon(task.content, u.iconColor)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, margin: 0, color: u.titleColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.content}</p>
                      {u.badge && <span style={{ fontSize: 9, background: u.badge.bg, color: u.badge.color, padding: '1px 6px', borderRadius: 10, fontWeight: 500, flexShrink: 0 }}>{u.badge.text}</span>}
                    </div>
                    <p style={{ fontSize: 12, color: u.subtitleColor, margin: 0, opacity: 0.8 }}>{cl?.company || cl?.name || ''} · {relTime(task.created_at)}</p>
                  </div>
                </div>
                <span style={{ fontSize: 13, color: u.arrowColor, marginLeft: 12, flexShrink: 0 }}>→</span>
              </div>
            );
          })}
          {unpaidInvs.map((inv) => {
            const cl = DB.clients.find((c) => c.id === inv.clientId);
            const total = (inv.items || []).reduce((s: number, i: any) => s + (i.qty || 1) * (i.price || 0), 0) + (inv.tax || 0) + (inv.shipping || 0);
            const u = getUrgencyStyle(inv.due || inv.date || new Date().toISOString());
            return (
              <div key={inv.id || inv._uuid} style={{
                background: u.background, border: u.border, borderLeft: u.borderLeft,
                borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer',
              }} onClick={() => router.push(`/clients/${inv.clientId}/invoices`)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                  {getActionIcon('invoice', u.iconColor)}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, margin: 0, color: u.titleColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Invoice {inv.id} · {currency(total)}</p>
                      {u.badge && <span style={{ fontSize: 9, background: u.badge.bg, color: u.badge.color, padding: '1px 6px', borderRadius: 10, fontWeight: 500, flexShrink: 0 }}>{u.badge.text}</span>}
                    </div>
                    <p style={{ fontSize: 12, color: u.subtitleColor, margin: 0, opacity: 0.8 }}>{cl?.company || cl?.name || ''}{inv.due ? ` · Due ${inv.due}` : ''}</p>
                  </div>
                </div>
                <span style={{ fontSize: 13, color: u.arrowColor, marginLeft: 12, flexShrink: 0 }}>→</span>
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
