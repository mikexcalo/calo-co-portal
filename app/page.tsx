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
const spring = { type: 'spring' as const, stiffness: 400, damping: 25 };

function ageDays(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

// Icons — 14-16px stroke-only
const ic = {
  checkbox: <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="1" width="16" height="16" rx="4"/></svg>,
  receipt: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 7h8M8 11h8M8 15h4"/></svg>,
  pencil: <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M10 3l5 5-9 9H1v-5l9-9z"/></svg>,
  trash: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  chevron: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="6 4 10 8 6 12"/></svg>,
  ds: <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><ellipse cx="7.5" cy="8.5" rx="6.5" ry="5.5"/><circle cx="5" cy="7" r="1" fill="currentColor" stroke="none"/><circle cx="8" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="10.5" cy="8" r="1" fill="currentColor" stroke="none"/><circle cx="4.5" cy="10" r="0.8" fill="none" stroke="currentColor" strokeWidth="1"/></svg>,
  bk: <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="3"/><circle cx="8" cy="8" r="0.8"/></svg>,
  inv: <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="2" y="1" width="12" height="14" rx="1.5"/><line x1="5" y1="5" x2="11" y2="5" strokeLinecap="round"/><line x1="5" y1="8" x2="11" y2="8" strokeLinecap="round"/><line x1="5" y1="11" x2="8" y2="11" strokeLinecap="round"/></svg>,
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
        + ' \u00b7 ' + now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }));
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
  const clients = [...DB.clients].sort((a, b) => {
    const ta = parseInt(localStorage.getItem(`client_accessed_${a.id}`) || '0', 10);
    const tb = parseInt(localStorage.getItem(`client_accessed_${b.id}`) || '0', 10);
    return tb - ta;
  });

  // Build action items
  type ActionItem = { id: string; type: 'task' | 'invoice' | 'note'; text: string; client: string; clientId?: string; age: number; created?: string };
  const actionItems: ActionItem[] = [];
  openTasks.forEach((tk) => {
    const cl = DB.clients.find((c) => c.id === tk.client_id);
    actionItems.push({ id: tk.id, type: 'task', text: tk.content, client: cl?.company || cl?.name || '', clientId: cl?.id, age: ageDays(tk.created_at), created: tk.created_at });
  });
  unpaidInvs.forEach((inv) => {
    const cl = DB.clients.find((c) => c.id === inv.clientId);
    actionItems.push({ id: inv.id || inv._uuid || '', type: 'invoice', text: `${currency(invTotal(inv))} ${inv.id}`, client: cl?.company || cl?.name || '', clientId: inv.clientId, age: inv.due ? Math.max(0, ageDays(inv.due)) : 0, created: inv.date });
  });
  openNotes.forEach((n) => {
    const cl = DB.clients.find((c) => c.id === n.client_id);
    actionItems.push({ id: n.id, type: 'note', text: n.content, client: cl?.company || cl?.name || '', clientId: cl?.id, age: ageDays(n.created_at), created: n.created_at });
  });

  const sectionLbl: React.CSSProperties = { fontSize: 10, fontWeight: 500, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 12px' };

  return (
    <div style={{ padding: 32, maxWidth: 960, minHeight: 'calc(100vh - 48px)' }}>
      <motion.div variants={stagger} initial="hidden" animate="show">

        {/* Greeting — BIG, editorial + avatar */}
        <motion.div variants={fadeUp} style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 400, color: t.text.primary, margin: '0 0 4px', letterSpacing: '-0.01em' }}>{greeting}</h1>
            <p style={{ fontSize: 13, color: t.text.tertiary, margin: 0 }}>{dateline}</p>
          </div>
          {(() => {
            const av = typeof window !== 'undefined' ? localStorage.getItem('calo-agency-avatar') : null;
            return (
              <div onClick={() => router.push('/settings?tab=profile')} style={{ cursor: 'pointer', flexShrink: 0 }}>
                {av ? (
                  <img src={av} alt="" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 600 }}>MC</div>
                )}
              </div>
            );
          })()}
        </motion.div>

        {/* Captain's Log — accent border, glow */}
        <motion.div variants={fadeUp} style={{
          marginBottom: 20,
          border: `1.5px solid ${t.accent.primary}`,
          borderRadius: 14,
          boxShadow: `0 0 12px ${t.accent.subtle}`,
          overflow: 'hidden',
        }}>
          <CommandBar onItemSaved={refreshFeed} />
        </motion.div>

        {/* Financial tiles — 4 columns */}
        <motion.div variants={fadeUp} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Revenue (MTD)', value: currency(paidMTD), color: t.status.success, href: '/financials' },
            { label: 'Outstanding', value: currency(stats.outstanding), color: t.status.warning, href: '/financials' },
            { label: 'Collected', value: currency(paidMTD), color: t.text.primary, href: '/financials' },
            { label: 'Active Clients', value: String(DB.clients.length), color: t.text.primary, href: '/clients' },
          ].map((m) => (
            <motion.div key={m.label} whileHover={{ y: -2 }} transition={spring}
              onClick={() => router.push(m.href)}
              style={{
                background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: t.radius.lg,
                padding: 16, cursor: 'pointer', transition: 'border-color 200ms, background 200ms',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = t.border.hover; (e.currentTarget as HTMLElement).style.background = t.bg.surfaceHover; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = t.border.default; (e.currentTarget as HTMLElement).style.background = t.bg.surface; }}
            >
              <div style={{ fontSize: 11, fontWeight: 500, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{m.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 28, fontWeight: 500, color: m.color }}>{m.value}</span>
                <span style={{ fontSize: 12, color: t.text.tertiary }}>→</span>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Two-column content — 1fr 1fr, aligned to tile widths */}
        <motion.div variants={fadeUp} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* Left — On deck */}
          <div>
            <div style={sectionLbl}>On deck</div>
            <div style={{ background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: t.radius.lg, overflow: 'hidden' }}>
              <AnimatePresence>
                {actionItems.map((item) => {
                  const isTask = item.type === 'task';
                  const isInv = item.type === 'invoice';
                  const isNote = item.type === 'note';
                  const ageColor = item.age >= 3 ? t.status.danger : item.age >= 2 ? t.status.warning : t.text.tertiary;
                  const isExpanded = expandedId === item.id;
                  return (
                    <motion.div key={item.id}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      exit={{ opacity: 0, height: 0, overflow: 'hidden' }} transition={{ duration: 0.2 }}
                    >
                      <div
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        style={{
                          padding: '12px 16px', borderBottom: `1px solid ${t.border.default}`,
                          cursor: 'pointer', transition: 'background 150ms',
                          borderLeft: isNote ? `2px dashed ${t.border.active}` : 'none',
                        }}
                        onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = t.bg.surfaceHover}
                        onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <span style={{ color: t.text.tertiary, flexShrink: 0, marginTop: 1 }}>
                            {isTask && ic.checkbox}{isInv && ic.receipt}{isNote && ic.pencil}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {isInv ? (
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 16, fontWeight: 500, color: t.text.primary }}>{item.text.split(' ')[0]}</span>
                                <span style={{ fontSize: 11, color: t.text.tertiary }}>{item.text.split(' ').slice(1).join(' ')} · {item.client}</span>
                                {item.age > 0 && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: t.accent.subtle, color: t.accent.text, fontWeight: 500 }}>{item.age}d</span>}
                              </div>
                            ) : (
                              <>
                                <div style={{ fontSize: 13, fontWeight: 500, color: isNote ? t.text.secondary : t.text.primary, fontStyle: isNote ? 'italic' : 'normal', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isExpanded ? 'normal' : 'nowrap' }}>{item.text}</div>
                                <div style={{ fontSize: 11, color: t.text.tertiary, marginTop: 2 }}>
                                  {item.client}{item.age > 0 ? ' · ' : ''}{item.age > 0 && <span style={{ color: ageColor }}>{item.age}d</span>}
                                </div>
                              </>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            <button title="Remove" onClick={(e) => { e.stopPropagation(); handleTrash(item.id, item.text); }} style={{
                              background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                              color: t.text.tertiary, transition: 'color 150ms',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.color = t.status.danger}
                            onMouseLeave={(e) => e.currentTarget.style.color = t.text.tertiary}
                            >{ic.trash}</button>
                            <button title="Open" onClick={(e) => { e.stopPropagation(); if (item.clientId) router.push(isInv ? `/clients/${item.clientId}/invoices` : `/clients/${item.clientId}`); }} style={{
                              background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                              color: t.text.tertiary, transition: 'color 150ms',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.color = t.text.primary}
                            onMouseLeave={(e) => e.currentTarget.style.color = t.text.tertiary}
                            >{ic.chevron}</button>
                          </div>
                        </div>
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }}
                              style={{ overflow: 'hidden', marginTop: 8, paddingTop: 8, borderTop: `0.5px solid ${t.border.default}` }}>
                              {item.created && <div style={{ fontSize: 11, color: t.text.tertiary, marginBottom: 4 }}>Created: {new Date(item.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>}
                              {item.clientId && <span onClick={(e) => { e.stopPropagation(); router.push(`/clients/${item.clientId}`); }} style={{ fontSize: 11, color: t.accent.text, cursor: 'pointer' }}>{item.client} →</span>}
                              {isTask && <button onClick={(e) => { e.stopPropagation(); handleTrash(item.id, item.text); }} style={{ display: 'block', marginTop: 6, fontSize: 11, fontWeight: 500, color: t.status.success, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>Mark complete</button>}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              {actionItems.length === 0 && (
                <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: t.text.tertiary }}>All clear</div>
              )}
            </div>
          </div>

          {/* Right — Clients */}
          <div>
            <div style={sectionLbl}>Clients</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {clients.map((client) => {
                const ct = DB.contacts[client.id] || [];
                const primary = ct.find((c) => c.isPrimary) || ct[0];
                const brandColor = (typeof client.brandKit?.colors?.[0] === 'string' ? client.brandKit.colors[0] : null) || t.text.tertiary;

                return (
                  <motion.div key={client.id} whileHover={{ y: -2 }} transition={spring}
                    style={{
                      background: t.bg.surface, border: `0.5px solid ${t.border.default}`, borderRadius: 10,
                      padding: 14, cursor: 'pointer', transition: 'border-color 150ms',
                    }}
                    onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.borderColor = t.border.hover}
                    onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.borderColor = t.border.default}
                    onClick={() => { localStorage.setItem(`client_accessed_${client.id}`, String(Date.now())); router.push(`/clients/${client.id}`); }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 7, flexShrink: 0, overflow: 'hidden',
                        background: client.logo ? 'transparent' : brandColor,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: 10, fontWeight: 700,
                      }}>
                        {client.logo ? <img src={client.logo} alt="" style={{ width: 32, height: 32, objectFit: 'cover' }} /> : (client.company || client.name).charAt(0)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: t.text.primary }}>{client.company || client.name}</div>
                        <div style={{ fontSize: 11, color: t.text.tertiary }}>{primary ? `${primary.name}${primary.title ? ' \u00b7 ' + primary.title : ''}` : 'No contact'}</div>
                      </div>
                    </div>
                    {/* Quick action buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 42 }}>
                      <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                        {[
                          { icon: ic.ds, href: `/clients/${client.id}/brand-builder`, label: 'Design Studio' },
                          { icon: ic.bk, href: `/clients/${client.id}/brand-kit`, label: 'Brand Kit' },
                          { icon: ic.inv, href: `/clients/${client.id}/invoices`, label: 'Invoices' },
                        ].map((btn, i) => (
                          <button key={i} title={btn.label} onClick={(e) => { e.stopPropagation(); router.push(btn.href); }}
                            style={{
                              width: 28, height: 28, borderRadius: 6, background: t.bg.surfaceHover, border: 'none',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer', color: t.text.secondary, transition: 'background 150ms, color 150ms',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = t.accent.primary; e.currentTarget.style.color = '#fff'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = t.bg.surfaceHover; e.currentTarget.style.color = t.text.secondary; }}
                          >{btn.icon}</button>
                        ))}
                      </div>
                      <div style={{ flex: 1 }} />
                      <button onClick={(e) => { e.stopPropagation(); localStorage.setItem(`client_accessed_${client.id}`, String(Date.now())); router.push(`/clients/${client.id}`); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: t.text.tertiary, transition: 'color 150ms' }}
                        onMouseEnter={(e) => e.currentTarget.style.color = t.text.primary}
                        onMouseLeave={(e) => e.currentTarget.style.color = t.text.tertiary}
                      >{ic.chevron}</button>
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
