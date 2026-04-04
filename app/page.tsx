'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  initSupabase, initAgency, loadClients, loadInvoices, loadContacts,
  loadAllBrandKits, loadActivityLog, loadExpenses, loadAgencySettings,
  loadTasksNotes, DB, updateTaskStatus, deleteTaskNote,
} from '@/lib/database';
import { agencyStats, currency } from '@/lib/utils';
import { tokens } from '@/lib/design-tokens';
import CommandBar from '@/components/dashboard/CommandBar';
import { motion } from 'framer-motion';

const t = tokens;
const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const fadeUp = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } } };

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

  function getUrgencyStyle(item: { content?: string; created_at?: string; due?: string; date?: string; id?: string }) {
    const content = (item.content || item.id || '').toLowerCase();
    const red = { background: '#FEF2F2', border: '0.5px solid rgba(252,165,165,0.27)', borderLeft: '3px solid #DC2626', titleColor: '#991B1B', subtitleColor: '#B91C1C', arrowColor: '#B91C1C', iconColor: '#DC2626' };
    const amber = { background: '#FFFBEB', border: '0.5px solid rgba(245,158,11,0.2)', borderLeft: '3px solid #F59E0B', titleColor: '#92400E', subtitleColor: '#B45309', arrowColor: '#B45309', iconColor: '#D97706' };
    const neutral = { background: '#ffffff', border: '0.5px solid #e5e7eb', borderLeft: '3px solid #e5e7eb', titleColor: '#111827', subtitleColor: '#9ca3af', arrowColor: '#9ca3af', iconColor: '#9ca3af' };

    // Communication items — look for "X days" in content
    if (content.includes('text ') || content.includes('call ') || content.includes('email ') || content.includes('message')) {
      const match = content.match(/(\d+)\s*days?\s*(since|ago|no\s*response|without)/i);
      const days = match ? parseInt(match[1], 10) : Math.floor((Date.now() - new Date(item.created_at || Date.now()).getTime()) / 86400000);
      if (days >= 3) return { ...red, badge: { text: days + 'd', bg: '#DC2626', color: '#fff' } };
      if (days >= 2) return { ...amber, badge: { text: days + 'd', bg: '#F59E0B', color: '#fff' } };
      return { ...neutral, badge: null as null };
    }

    // Invoice items — calculate days until due
    if (content.includes('invoice') && item.due) {
      try {
        const dueDate = new Date(item.due);
        if (!isNaN(dueDate.getTime())) {
          const daysUntil = Math.floor((dueDate.getTime() - Date.now()) / 86400000);
          if (daysUntil <= 0) return { ...red, badge: { text: 'overdue', bg: '#DC2626', color: '#fff' } };
          if (daysUntil <= 3) return { ...amber, badge: { text: daysUntil + 'd left', bg: '#F59E0B', color: '#fff' } };
          if (daysUntil <= 7) return { ...amber, badge: { text: daysUntil + 'd left', bg: '#F59E0B', color: '#fff' } };
        }
      } catch {}
    }

    // Default — fallback to created_at age
    const created = new Date(item.created_at || item.date || Date.now());
    const daysSince = Math.floor((Date.now() - created.getTime()) / 86400000);
    if (daysSince >= 3) return { ...red, badge: { text: daysSince + 'd', bg: '#DC2626', color: '#fff' } };
    if (daysSince >= 2) return { ...amber, badge: { text: daysSince + 'd', bg: '#F59E0B', color: '#fff' } };
    return { ...neutral, badge: null as null };
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

  const paidMTD = DB.invoices.filter((i) => i.status === 'paid').reduce((s, i) => {
    const t = (i.items || []).reduce((a: number, x: any) => a + (x.qty || 1) * (x.price || 0), 0) + (i.tax || 0) + (i.shipping || 0);
    return s + t;
  }, 0);

  // Recent clients — sorted by last access
  const recentClients = [...clients].sort((a, b) => {
    const ta = parseInt(localStorage.getItem(`client_accessed_${a.id}`) || '0', 10);
    const tb = parseInt(localStorage.getItem(`client_accessed_${b.id}`) || '0', 10);
    return tb - ta;
  }).slice(0, 8);

  const sectionLbl: React.CSSProperties = { fontSize: 11, fontWeight: 500, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 12px' };

  return (
    <div style={{ padding: 32, maxWidth: 960 }}>
      <motion.div variants={stagger} initial="hidden" animate="show">
        {/* Greeting */}
        <motion.div variants={fadeUp}>
          <h1 style={{ fontSize: 24, fontWeight: 400, color: t.text.primary, margin: '0 0 2px' }}>{greeting}</h1>
          <p style={{ fontSize: 13, color: t.text.tertiary, margin: '0 0 24px' }}>{dateline}</p>
        </motion.div>

        {/* Metric cards */}
        <motion.div variants={fadeUp} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 24 }}>
          {[
            { label: 'Active Clients', value: String(clients.length), href: '/clients' },
            { label: 'Open Invoices', value: String(unpaidInvs.length), href: '/invoices', color: t.status.warning },
            { label: 'Revenue (MTD)', value: currency(paidMTD), href: '/financials', color: t.status.success },
            { label: 'Pending', value: currency(stats.outstanding), href: '/financials', color: t.status.warning },
          ].map((m) => (
            <motion.div key={m.label} whileHover={{ y: -2 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              onClick={() => router.push(m.href)} style={{
                background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: t.radius.lg,
                padding: 16, cursor: 'pointer', transition: 'border-color 200ms, background 200ms',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.border.hover; e.currentTarget.style.background = t.bg.surfaceHover; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border.default; e.currentTarget.style.background = t.bg.surface; }}
            >
              <div style={{ fontSize: 11, fontWeight: 500, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{m.label}</div>
              <div style={{ fontSize: 28, fontWeight: 500, color: m.color || t.text.primary }}>{m.value}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Command Bar */}
        <motion.div variants={fadeUp} style={{ marginBottom: 24 }}>
          <CommandBar onItemSaved={refreshFeed} />
        </motion.div>

        {/* Action items */}
        {(openTasks.length > 0 || unpaidInvs.length > 0) && (
          <motion.div variants={fadeUp} style={{ marginBottom: 24 }}>
            <div style={sectionLbl}>Action items</div>
            <div style={{ background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: t.radius.lg, overflow: 'hidden' }}>
              {openTasks.map((task) => {
                const cl = DB.clients.find((c) => c.id === task.client_id);
                const u = getUrgencyStyle(task);
                const isUrgent = u.badge && (u.badge.bg === '#DC2626' || u.badge.bg === '#F59E0B');
                return (
                  <div key={task.id} onClick={() => cl && router.push(`/clients/${cl.id}`)} style={{
                    padding: '12px 16px', borderBottom: `1px solid ${t.border.default}`, display: 'flex', alignItems: 'center', cursor: 'pointer',
                    transition: 'background 150ms',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = t.bg.surfaceHover}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <div onClick={async (e) => { e.stopPropagation(); await updateTaskStatus(task.id, 'complete'); refreshFeed(); }} style={{ cursor: 'pointer', marginRight: 10, color: t.text.tertiary }}>
                      {getActionIcon(task.content, t.text.tertiary)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: t.text.primary }}>{task.content}</span>
                      {u.badge && <span style={{ fontSize: 9, background: isUrgent ? t.accent.subtle : t.bg.surfaceHover, color: isUrgent ? t.accent.text : t.text.secondary, padding: '2px 6px', borderRadius: 4, fontWeight: 500, marginLeft: 6 }}>{u.badge.text}</span>}
                    </div>
                    <span style={{ fontSize: 13, color: t.text.tertiary, flexShrink: 0 }}>{cl?.company || cl?.name || ''}</span>
                  </div>
                );
              })}
              {unpaidInvs.map((inv) => {
                const cl = DB.clients.find((c) => c.id === inv.clientId);
                const total = (inv.items || []).reduce((s: number, i: any) => s + (i.qty || 1) * (i.price || 0), 0) + (inv.tax || 0) + (inv.shipping || 0);
                const u = getUrgencyStyle({ content: `invoice ${inv.id}`, due: inv.due, date: inv.date, created_at: inv.date });
                const isUrgent = u.badge && (u.badge.bg === '#DC2626' || u.badge.bg === '#F59E0B');
                return (
                  <div key={inv.id || inv._uuid} onClick={() => router.push(`/clients/${inv.clientId}/invoices`)} style={{
                    padding: '12px 16px', borderBottom: `1px solid ${t.border.default}`, display: 'flex', alignItems: 'center', cursor: 'pointer',
                    transition: 'background 150ms',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = t.bg.surfaceHover}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <span style={{ color: t.text.tertiary, marginRight: 10 }}>{getActionIcon('invoice', t.text.tertiary)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: t.text.primary }}>Invoice {inv.id} · {currency(total)}</span>
                      {u.badge && <span style={{ fontSize: 9, background: isUrgent ? t.accent.subtle : t.bg.surfaceHover, color: isUrgent ? t.accent.text : t.text.secondary, padding: '2px 6px', borderRadius: 4, fontWeight: 500, marginLeft: 6 }}>{u.badge.text}</span>}
                    </div>
                    <span style={{ fontSize: 13, color: t.text.tertiary, flexShrink: 0 }}>{cl?.company || cl?.name || ''}</span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Recent activity */}
        <motion.div variants={fadeUp} style={{ marginBottom: 24 }}>
          <div style={sectionLbl}>Recent activity</div>
          <div style={{ background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: t.radius.lg, overflow: 'hidden' }}>
            {recentClients.map((client) => (
              <div key={client.id} onClick={() => { localStorage.setItem(`client_accessed_${client.id}`, String(Date.now())); router.push(`/clients/${client.id}`); }}
                style={{ padding: '10px 16px', borderBottom: `1px solid ${t.border.default}`, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', transition: 'background 150ms' }}
                onMouseEnter={(e) => e.currentTarget.style.background = t.bg.surfaceHover}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                {client.logo ? (
                  <img src={client.logo} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: t.bg.surfaceHover, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: t.text.secondary, flexShrink: 0 }}>
                    {(client.company || client.name).charAt(0)}
                  </div>
                )}
                <span style={{ fontSize: 14, fontWeight: 500, color: t.text.primary, flex: 1 }}>{client.company || client.name}</span>
                <span style={{ fontSize: 13, color: t.text.tertiary, transition: 'transform 200ms' }}>→</span>
              </div>
            ))}
            {recentClients.length === 0 && (
              <div style={{ padding: 20, textAlign: 'center', fontSize: 13, color: t.text.tertiary }}>No clients yet</div>
            )}
          </div>
        </motion.div>

        {/* Quick actions */}
        <motion.div variants={fadeUp}>
          <div style={sectionLbl}>Quick actions</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            {[
              { label: '+ New Client', sub: 'Add a new client', href: '/clients/new', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/><line x1="18" y1="5" x2="18" y2="11"/><line x1="15" y1="8" x2="21" y2="8"/></svg> },
              { label: '+ New Invoice', sub: 'Create an invoice', href: '/invoices', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="7" x2="16" y2="7" strokeLinecap="round"/><line x1="8" y1="11" x2="16" y2="11" strokeLinecap="round"/><line x1="8" y1="15" x2="12" y2="15" strokeLinecap="round"/></svg> },
              { label: 'Design Studio', sub: 'Open a client\u2019s studio', href: '/clients', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="1.5" y="1.5" width="21" height="21" rx="2"/><line x1="1.5" y1="8" x2="22.5" y2="8"/><line x1="8" y1="8" x2="8" y2="22.5"/></svg> },
            ].map((a) => (
              <motion.button key={a.label} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                onClick={() => router.push(a.href)} style={{
                  background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: t.radius.lg,
                  padding: 24, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', width: '100%',
                  transition: 'border-color 200ms, box-shadow 200ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.border.hover; e.currentTarget.style.boxShadow = t.shadow.card; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border.default; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div style={{ color: t.text.tertiary, marginBottom: 8 }}>{a.icon}</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: t.text.primary }}>{a.label.startsWith('+') ? <><span style={{ color: t.accent.text }}>+</span>{a.label.slice(1)}</> : a.label}</div>
                <div style={{ fontSize: 13, color: t.text.tertiary, marginTop: 2 }}>{a.sub}</div>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Footer */}
        <div style={{ textAlign: 'center', padding: '32px 0 8px', fontSize: 11, color: t.text.tertiary }}>
          Powered by CALO&CO
        </div>
      </motion.div>
    </div>
  );
}
