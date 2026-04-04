'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  initSupabase, initAgency, loadClients, loadInvoices, loadContacts,
  loadAllBrandKits, loadActivityLog, loadExpenses, loadAgencySettings,
  loadTasksNotes, DB, updateTaskStatus,
} from '@/lib/database';
import { agencyStats, currency, invTotal } from '@/lib/utils';
import CommandBar from '@/components/dashboard/CommandBar';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/lib/theme';

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const fadeUp = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } } };

function relTime(iso: string): string {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const dy = Math.floor(h / 24);
  return dy === 1 ? '1d ago' : `${dy}d ago`;
}

function ageDays(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export default function Home() {
  const router = useRouter();
  const { t } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [greeting, setGreeting] = useState('Good morning');
  const [dateline, setDateline] = useState('');
  const [stats, setStats] = useState(agencyStats([], []));
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [toast, setToast] = useState<{ id: string; text: string } | null>(null);

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

  const refreshFeed = useCallback(() => { loadTasksNotes().then(setAllTasks); }, []);

  const handleTrash = async (taskId: string, text: string) => {
    await updateTaskStatus(taskId, 'complete');
    setAllTasks((prev) => prev.filter((t) => t.id !== taskId));
    setToast({ id: taskId, text });
    setTimeout(() => setToast(null), 5000);
  };

  const handleUndo = async () => {
    if (!toast) return;
    await updateTaskStatus(toast.id, 'open');
    setToast(null);
    refreshFeed();
  };

  if (isLoading) return <div style={{ padding: 32, opacity: 0.5, fontSize: 13, color: t.text.tertiary }}>Loading dashboard...</div>;

  // Data
  const openTasks = allTasks.filter((tk) => tk.type === 'task' && tk.status === 'open')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const unpaidInvs = DB.invoices.filter((i) => i.status === 'unpaid' || i.status === 'overdue')
    .sort((a, b) => { const da = a.due ? new Date(a.due).getTime() : Infinity; const db = b.due ? new Date(b.due).getTime() : Infinity; return da - db; });
  const clients = DB.clients.sort((a, b) => {
    const ta = parseInt(localStorage.getItem(`client_accessed_${a.id}`) || '0', 10);
    const tb = parseInt(localStorage.getItem(`client_accessed_${b.id}`) || '0', 10);
    return tb - ta;
  });

  // Inline metrics
  const clientCount = DB.clients.length;
  const openInvCount = unpaidInvs.length;
  const pendingAmt = currency(stats.outstanding);

  // All action items combined
  const actionItems: { id: string; icon: string; text: string; client: string; clientId?: string; age: number; badge?: string }[] = [];
  openTasks.forEach((tk) => {
    const cl = DB.clients.find((c) => c.id === tk.client_id);
    const days = ageDays(tk.created_at);
    actionItems.push({ id: tk.id, icon: 'task', text: tk.content, client: cl?.company || cl?.name || '', clientId: cl?.id, age: days, badge: days >= 3 ? `${days}d` : days >= 2 ? `${days}d` : undefined });
  });
  unpaidInvs.forEach((inv) => {
    const cl = DB.clients.find((c) => c.id === inv.clientId);
    const total = invTotal(inv);
    const days = inv.due ? Math.max(0, Math.floor((Date.now() - new Date(inv.due).getTime()) / 86400000)) : 0;
    actionItems.push({ id: inv.id || inv._uuid || '', icon: 'invoice', text: `Invoice ${inv.id} · ${currency(total)}`, client: cl?.company || cl?.name || '', clientId: inv.clientId, age: days, badge: days > 0 ? 'overdue' : undefined });
  });

  const sectionLbl: React.CSSProperties = { fontSize: 11, fontWeight: 500, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 12px' };

  return (
    <div style={{ padding: '24px 32px', maxWidth: 960, height: 'calc(100vh - 48px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <motion.div variants={stagger} initial="hidden" animate="show" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

        {/* Greeting + inline metrics */}
        <motion.div variants={fadeUp} style={{ marginBottom: 16, flexShrink: 0 }}>
          <p style={{ fontSize: 18, fontWeight: 400, color: t.text.primary, margin: '0 0 2px' }}>
            {greeting} — <span style={{ color: t.text.secondary }}>
              <span style={{ color: t.text.primary }}>{clientCount}</span> clients · <span style={{ color: t.text.primary }}>{openInvCount}</span> open invoice{openInvCount !== 1 ? 's' : ''} · <span style={{ color: t.text.primary }}>{pendingAmt}</span> pending
            </span>
          </p>
          <p style={{ fontSize: 13, color: t.text.tertiary, margin: 0 }}>{dateline}</p>
        </motion.div>

        {/* Command bar — hero */}
        <motion.div variants={fadeUp} style={{ marginBottom: 20, flexShrink: 0 }}>
          <CommandBar onItemSaved={refreshFeed} />
        </motion.div>

        {/* Two-column content */}
        <motion.div variants={fadeUp} style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 24, flex: 1, minHeight: 0 }}>

          {/* Left — Action items */}
          <div style={{ minHeight: 0, overflow: 'auto' }}>
            <div style={sectionLbl}>Action items</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <AnimatePresence>
                {actionItems.map((item) => {
                  const isUrgent = item.age >= 3;
                  const isMedium = item.age >= 2;
                  return (
                    <motion.div key={item.id}
                      initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95, height: 0, marginBottom: 0, padding: 0, overflow: 'hidden' }}
                      transition={{ duration: 0.2 }}
                      whileHover={{ y: -1 }}
                      onClick={() => item.clientId && router.push(`/clients/${item.clientId}`)}
                      style={{
                        background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: t.radius.md,
                        padding: 14, minHeight: 80, cursor: 'pointer', display: 'flex', flexDirection: 'column',
                        transition: 'border-color 150ms',
                      }}
                      onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.borderColor = t.border.hover}
                      onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.borderColor = t.border.default}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flex: 1 }}>
                        <span style={{ color: t.text.tertiary, flexShrink: 0, marginTop: 1 }}>
                          {item.icon === 'invoice'
                            ? <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="1" width="12" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M5 5h6M5 8h6M5 11h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/></svg>
                            : <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3"/><path d="M8 4.5v4l2.5 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                          }
                        </span>
                        <span style={{ fontSize: 13, color: t.text.primary, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } as any}>{item.text}</span>
                      </div>
                      <div style={{ fontSize: 12, color: t.text.secondary, marginTop: 4 }}>{item.client}</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                        {item.badge ? (
                          <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, background: isUrgent ? t.accent.subtle : t.bg.surfaceHover, color: isUrgent ? t.accent.text : isMedium ? t.status.warning : t.text.secondary, fontWeight: 500 }}>{item.badge}</span>
                        ) : <span />}
                        <button onClick={(e) => { e.stopPropagation(); handleTrash(item.id, item.text); }} style={{
                          background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: t.text.tertiary,
                          transition: 'color 150ms', fontSize: 0,
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = t.status.danger}
                        onMouseLeave={(e) => e.currentTarget.style.color = t.text.tertiary}
                        >
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/></svg>
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              {actionItems.length === 0 && (
                <div style={{ gridColumn: '1 / -1', background: t.bg.surface, border: `1px dashed ${t.border.default}`, borderRadius: t.radius.md, padding: 24, textAlign: 'center', color: t.text.tertiary, fontSize: 13 }}>
                  All clear
                </div>
              )}
            </div>
          </div>

          {/* Right — Clients */}
          <div style={{ minHeight: 0, overflow: 'auto' }}>
            <div style={sectionLbl}>Clients</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {clients.map((client) => {
                const ct = DB.contacts[client.id] || [];
                const primary = ct.find((c) => c.isPrimary) || ct[0];
                const clientInvs = DB.invoices.filter((i) => i.clientId === client.id);
                const clientUnpaid = clientInvs.filter((i) => i.status === 'unpaid' || i.status === 'overdue');
                const due = clientUnpaid.reduce((s, i) => s + invTotal(i), 0);
                const lastAccess = localStorage.getItem(`client_accessed_${client.id}`);
                const lastStr = lastAccess ? relTime(new Date(parseInt(lastAccess, 10)).toISOString()) : '—';
                const brandColor = client.brandKit?.colors?.[0] || '#6b7280';

                return (
                  <motion.div key={client.id} whileHover={{ y: -1 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    onClick={() => { localStorage.setItem(`client_accessed_${client.id}`, String(Date.now())); router.push(`/clients/${client.id}`); }}
                    style={{
                      background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: t.radius.lg,
                      padding: 16, cursor: 'pointer', transition: 'border-color 150ms',
                    }}
                    onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.borderColor = t.border.hover}
                    onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.borderColor = t.border.default}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      {client.logo ? (
                        <img src={client.logo} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 28, height: 28, borderRadius: 6, background: t.bg.surfaceHover, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: t.text.secondary, flexShrink: 0 }}>
                          {(client.company || client.name).charAt(0)}
                        </div>
                      )}
                      <span style={{ fontSize: 14, fontWeight: 500, color: t.text.primary, flex: 1 }}>{client.company || client.name}</span>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: typeof brandColor === 'string' ? brandColor : '#6b7280', flexShrink: 0 }} />
                    </div>
                    {primary && <div style={{ fontSize: 13, color: t.text.secondary, marginBottom: 4 }}>{primary.name}</div>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: t.text.secondary }}>{clientInvs.length} inv · {currency(due)} due</span>
                      <span style={{ color: t.text.tertiary }}>Last: {lastStr}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 100,
              background: t.bg.elevated, border: `1px solid ${t.border.default}`, borderRadius: t.radius.md,
              padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10,
              boxShadow: t.shadow.elevated, maxWidth: 400,
            }}
          >
            <span style={{ fontSize: 13, color: t.text.primary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {toast.text.length > 30 ? toast.text.slice(0, 30) + '...' : toast.text} trashed
            </span>
            <button onClick={handleUndo} style={{ background: 'none', border: 'none', color: t.accent.text, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
              Undo
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
