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

// Small SVG icons
const icons = {
  checkbox: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="1" y="1" width="16" height="16" rx="4" stroke="currentColor" strokeWidth="1.5"/></svg>,
  dollar: <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="9" cy="9" r="7"/><path d="M9 4v10M7 6.5c0-.8 1-1.5 2-1.5s2 .7 2 1.5-1 1.5-2 1.5-2 .7-2 1.5 1 1.5 2 1.5 2-.7 2-1.5" strokeLinecap="round"/></svg>,
  pencil: <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M10 3l5 5-9 9H1v-5l9-9z"/><path d="M8.5 4.5l5 5"/></svg>,
  trash: <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/></svg>,
  chevron: <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="6 4 10 8 6 12"/></svg>,
  ds: <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2"><rect x="1.5" y="1.5" width="13" height="13" rx="1.5"/><line x1="1.5" y1="6" x2="14.5" y2="6"/><line x1="6" y1="6" x2="6" y2="14.5"/></svg>,
  bk: <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2"><circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="3"/></svg>,
  inv: <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2"><rect x="2" y="1" width="12" height="14" rx="1.5"/><line x1="5" y1="5" x2="11" y2="5" strokeLinecap="round"/><line x1="5" y1="8" x2="11" y2="8" strokeLinecap="round"/></svg>,
};

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
      setDateline(now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
        + ' · ' + now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }));
    };
    tick();
    const iv = setInterval(tick, 60000);
    return () => clearInterval(iv);
  }, []);

  const refreshFeed = useCallback(() => { loadTasksNotes().then(setAllTasks); }, []);

  const handleTrash = async (id: string, text: string) => {
    await updateTaskStatus(id, 'complete');
    setAllTasks((prev) => prev.filter((tk) => tk.id !== id));
    setToast({ id, text });
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
  const openNotes = allTasks.filter((tk) => tk.type === 'note' && tk.status === 'open')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 3);
  const unpaidInvs = DB.invoices.filter((i) => i.status === 'unpaid' || i.status === 'overdue')
    .sort((a, b) => { const da = a.due ? new Date(a.due).getTime() : Infinity; const db = b.due ? new Date(b.due).getTime() : Infinity; return da - db; });

  const paidMTD = DB.invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + invTotal(i), 0);
  const collected = paidMTD;

  const clients = [...DB.clients].sort((a, b) => {
    const ta = parseInt(localStorage.getItem(`client_accessed_${a.id}`) || '0', 10);
    const tb = parseInt(localStorage.getItem(`client_accessed_${b.id}`) || '0', 10);
    return tb - ta;
  });

  // Build action items
  type ActionItem = { id: string; type: 'task' | 'invoice' | 'note'; text: string; client: string; clientId?: string; age: number };
  const actionItems: ActionItem[] = [];
  openTasks.forEach((tk) => {
    const cl = DB.clients.find((c) => c.id === tk.client_id);
    actionItems.push({ id: tk.id, type: 'task', text: tk.content, client: cl?.company || cl?.name || '', clientId: cl?.id, age: ageDays(tk.created_at) });
  });
  unpaidInvs.forEach((inv) => {
    const cl = DB.clients.find((c) => c.id === inv.clientId);
    actionItems.push({ id: inv.id || inv._uuid || '', type: 'invoice', text: `${currency(invTotal(inv))} ${inv.id}`, client: cl?.company || cl?.name || '', clientId: inv.clientId, age: inv.due ? Math.max(0, ageDays(inv.due)) : 0 });
  });
  openNotes.forEach((n) => {
    const cl = DB.clients.find((c) => c.id === n.client_id);
    actionItems.push({ id: n.id, type: 'note', text: n.content, client: cl?.company || cl?.name || '', clientId: cl?.id, age: ageDays(n.created_at) });
  });

  const sectionLbl: React.CSSProperties = { fontSize: 10, fontWeight: 500, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 10px' };

  const iconBtn = (icon: React.ReactNode, onClick: (e: React.MouseEvent) => void, hover?: string) => (
    <button onClick={onClick} style={{
      width: 28, height: 28, borderRadius: 6, background: t.bg.surfaceHover, border: 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', color: t.text.secondary, transition: 'color 150ms',
    }}
    onMouseEnter={(e) => { if (hover) e.currentTarget.style.color = hover; }}
    onMouseLeave={(e) => e.currentTarget.style.color = t.text.secondary}
    >{icon}</button>
  );

  return (
    <div style={{ padding: '20px 32px', maxWidth: 960, height: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <motion.div variants={stagger} initial="hidden" animate="show" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

        {/* Greeting */}
        <motion.div variants={fadeUp} style={{ marginBottom: 14, flexShrink: 0 }}>
          <p style={{ fontSize: 20, fontWeight: 400, color: t.text.primary, margin: '0 0 2px' }}>{greeting}</p>
          <p style={{ fontSize: 12, color: t.text.tertiary, margin: 0 }}>{dateline}</p>
        </motion.div>

        {/* Command bar — hero */}
        <motion.div variants={fadeUp} style={{ marginBottom: 16, flexShrink: 0 }}>
          <CommandBar onItemSaved={refreshFeed} />
        </motion.div>

        {/* Financial tiles */}
        <motion.div variants={fadeUp} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16, flexShrink: 0 }}>
          {[
            { label: 'Revenue (MTD)', value: currency(paidMTD), color: t.status.success },
            { label: 'Outstanding', value: currency(stats.outstanding), color: t.status.warning },
            { label: 'Collected', value: currency(collected), color: t.text.primary },
          ].map((m) => (
            <div key={m.label} style={{ background: t.bg.surface, borderRadius: t.radius.md, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 2 }}>{m.label}</div>
              <div style={{ fontSize: 22, fontWeight: 500, color: m.color }}>{m.value}</div>
            </div>
          ))}
        </motion.div>

        {/* Two-column content */}
        <motion.div variants={fadeUp} style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 20, flex: 1, minHeight: 0 }}>

          {/* Left — Needs attention */}
          <div style={{ minHeight: 0, overflow: 'auto' }}>
            <div style={sectionLbl}>Needs attention</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <AnimatePresence>
                {actionItems.map((item) => {
                  const isTask = item.type === 'task';
                  const isInv = item.type === 'invoice';
                  const isNote = item.type === 'note';
                  const ageColor = item.age >= 3 ? t.status.danger : item.age >= 2 ? t.status.warning : t.text.tertiary;
                  return (
                    <motion.div key={item.id}
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0, overflow: 'hidden' }} transition={{ duration: 0.2 }}
                    >
                      <div style={{
                        background: t.bg.surface,
                        border: `0.5px ${isNote ? 'dashed' : 'solid'} ${t.border.default}`,
                        borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'flex-start', gap: 10,
                      }}>
                        {/* Left icon */}
                        <span style={{ color: t.text.tertiary, flexShrink: 0, marginTop: 1 }}>
                          {isTask && icons.checkbox}
                          {isInv && icons.dollar}
                          {isNote && icons.pencil}
                        </span>
                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {isInv ? (
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                              <span style={{ fontSize: 16, fontWeight: 500, color: t.text.primary }}>{item.text.split(' ')[0]}</span>
                              <span style={{ fontSize: 11, color: t.text.tertiary }}>{item.text.split(' ').slice(1).join(' ')} · {item.client}</span>
                              {item.age > 0 && <span style={{ fontSize: 11, color: t.status.warning }}>{item.age}d</span>}
                            </div>
                          ) : (
                            <>
                              <div style={{ fontSize: 12, fontWeight: 500, color: isNote ? t.text.secondary : t.text.primary, fontStyle: isNote ? 'italic' : 'normal', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.text}</div>
                              <div style={{ fontSize: 11, color: t.text.tertiary, marginTop: 2 }}>
                                {item.client}{item.age > 0 ? ' · ' : ''}{item.age > 0 && <span style={{ color: ageColor }}>{item.age}d</span>}
                              </div>
                            </>
                          )}
                        </div>
                        {/* Actions */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                          <button onClick={(e) => { e.stopPropagation(); handleTrash(item.id, item.text); }} style={{
                            background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                            color: t.text.tertiary, opacity: 0.5, transition: 'opacity 150ms, color 150ms',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = t.status.danger; }}
                          onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.5'; e.currentTarget.style.color = t.text.tertiary; }}
                          >{icons.trash}</button>
                          <button onClick={(e) => { e.stopPropagation(); if (item.clientId) router.push(`/clients/${item.clientId}`); }} style={{
                            background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                            color: t.text.tertiary, opacity: 0.5, transition: 'opacity 150ms',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                          onMouseLeave={(e) => e.currentTarget.style.opacity = '0.5'}
                          >{icons.chevron}</button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              {actionItems.length === 0 && (
                <div style={{ textAlign: 'center', padding: 24, fontSize: 13, color: t.text.tertiary }}>All clear</div>
              )}
            </div>
          </div>

          {/* Right — Clients */}
          <div style={{ minHeight: 0, overflow: 'auto' }}>
            <div style={sectionLbl}>Clients</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {clients.map((client) => {
                const ct = DB.contacts[client.id] || [];
                const primary = ct.find((c) => c.isPrimary) || ct[0];
                const clientInvs = DB.invoices.filter((i) => i.clientId === client.id);
                const brandColor = (typeof client.brandKit?.colors?.[0] === 'string' ? client.brandKit.colors[0] : null) || t.text.tertiary;

                return (
                  <motion.div key={client.id} whileHover={{ y: -1 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    style={{
                      background: t.bg.surface, border: `0.5px solid ${t.border.default}`, borderRadius: 10,
                      padding: 12, cursor: 'pointer', transition: 'border-color 150ms',
                    }}
                    onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.borderColor = t.border.hover}
                    onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.borderColor = t.border.default}
                    onClick={() => { localStorage.setItem(`client_accessed_${client.id}`, String(Date.now())); router.push(`/clients/${client.id}`); }}
                  >
                    {/* Top row: logo + name + contact */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 7, flexShrink: 0, overflow: 'hidden',
                        background: brandColor, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: 10, fontWeight: 700,
                      }}>
                        {client.logo ? <img src={client.logo} alt="" style={{ width: 32, height: 32, objectFit: 'cover' }} /> : (client.company || client.name).charAt(0)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: t.text.primary }}>{client.company || client.name}</div>
                        <div style={{ fontSize: 11, color: t.text.tertiary }}>{primary ? `${primary.name}${primary.title ? ' · ' + primary.title : ''}` : 'No contact'}</div>
                      </div>
                    </div>
                    {/* Bottom row: quick actions + chevron */}
                    <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 42 }}>
                      <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                        {iconBtn(icons.ds, (e) => { e.stopPropagation(); router.push(`/clients/${client.id}/brand-builder`); })}
                        {iconBtn(icons.bk, (e) => { e.stopPropagation(); router.push(`/clients/${client.id}/brand-kit`); })}
                        {iconBtn(icons.inv, (e) => { e.stopPropagation(); router.push(`/clients/${client.id}/invoices`); })}
                      </div>
                      <div style={{ flex: 1 }} />
                      <span style={{ color: t.text.tertiary, opacity: 0.5 }}>{icons.chevron}</span>
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
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} transition={{ duration: 0.2 }}
            style={{
              position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 100,
              background: t.bg.elevated, border: `1px solid ${t.border.default}`, borderRadius: t.radius.md,
              padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10,
              boxShadow: t.shadow.elevated, maxWidth: 400,
            }}
          >
            <span style={{ fontSize: 13, color: t.text.primary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {toast.text.length > 30 ? toast.text.slice(0, 30) + '...' : toast.text} removed
            </span>
            <button onClick={handleUndo} style={{ background: 'none', border: 'none', color: t.accent.text, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>Undo</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
