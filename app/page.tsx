'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  initSupabase, initAgency, loadClients, loadInvoices, loadContacts,
  loadAllBrandKits, loadActivityLog, loadExpenses, loadAgencySettings,
  loadTasksNotes, DB, updateTaskStatus, deleteInvoice, saveTaskNote,
} from '@/lib/database';
import { agencyStats, currency, invTotal } from '@/lib/utils';
import CommandBar from '@/components/dashboard/CommandBar';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/lib/theme';
import HelmSpinner from '@/components/shared/HelmSpinner';
import Toast from '@/components/shared/Toast';
import useCountUp from '@/lib/useCountUp';

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const fadeUp = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } } };
const spring = { type: 'spring' as const, stiffness: 400, damping: 25 };

function ageDays(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

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

type ActionItem = { id: string; type: 'task' | 'invoice' | 'note'; text: string; client: string; clientId?: string; age: number; created?: string };

export default function Home() {
  const router = useRouter();
  const { t } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [greeting, setGreeting] = useState('Good morning');
  const [dateline, setDateline] = useState('');
  const [stats, setStats] = useState(agencyStats([], []));
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [toast, setToast] = useState<{ id: string; text: string; itemType: 'task' | 'invoice' | 'note' } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const [noteInput, setNoteInput] = useState('');
  const [noteSubmitting, setNoteSubmitting] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        await initSupabase(); await initAgency();
        if (DB.clientsState !== 'loaded') await loadClients();
        await Promise.allSettled(DB.clients.flatMap((c) => [loadInvoices(c.id), loadContacts(c.id)]));
        await loadAllBrandKits(); await loadActivityLog();
        await loadExpenses().catch(() => {}); await loadAgencySettings().catch(() => {});
        setStats(agencyStats(DB.invoices, DB.clients));
        setAllTasks(await loadTasksNotes());
      } catch (e) { console.error('Init error:', e); }
      finally { setIsLoading(false); }
    };
    init();
  }, []);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const h = now.getHours();
      setGreeting(`Good ${h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'}, Mike`);
      setDateline(now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
        + ' \u00b7 ' + now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }));
    };
    tick(); const iv = setInterval(tick, 60000); return () => clearInterval(iv);
  }, []);

  const refreshFeed = useCallback(() => { loadTasksNotes().then(setAllTasks); }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        if (searchResult) { setSearchResult(null); setSearchQuery(''); }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [searchResult]);

  const handlePlatformSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true); setSearchResult(null);
    try {
      const resp = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: searchQuery }) });
      const data = await resp.json();
      setSearchResult(data.answer || data.content || 'No results found.');
    } catch { setSearchResult('Search failed.'); }
    finally { setSearchLoading(false); }
  };

  const handleAddNote = async () => {
    const text = noteInput.trim();
    if (!text || noteSubmitting) return;
    setNoteSubmitting(true);
    try {
      const clientId = DB.clients[0]?.id;
      if (clientId) {
        await saveTaskNote(clientId, 'note', text);
        const tasks = await loadTasksNotes();
        setAllTasks(tasks);
      }
      setNoteInput('');
    } catch (e) { console.error('Failed to add note:', e); }
    finally { setNoteSubmitting(false); }
  };

  const handleTrash = async (id: string, text: string, itemType: 'task' | 'invoice' | 'note') => {
    if (itemType === 'invoice') await deleteInvoice(id);
    else await updateTaskStatus(id, 'complete');
    setAllTasks((prev) => prev.filter((tk) => tk.id !== id));
    setToast({ id, text, itemType });
  };

  const handleUndo = async () => {
    if (!toast) return;
    if (toast.itemType === 'invoice') { setToast(null); return; }
    await updateTaskStatus(toast.id, 'open'); setToast(null); refreshFeed();
  };

  // Data (computed before hooks to satisfy Rules of Hooks — no early returns before hooks)
  const paidMTD = isLoading ? 0 : DB.invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + invTotal(i), 0);
  const animRevenue = useCountUp(paidMTD);
  const animOutstanding = useCountUp(stats.outstanding);
  const animCollected = useCountUp(paidMTD);

  if (isLoading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: 0 }}><HelmSpinner size={32} /></div>;

  // Data
  const openTasks = allTasks.filter((tk) => tk.type === 'task' && tk.status === 'open')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const openNotes = allTasks.filter((tk) => tk.type === 'note' && tk.status === 'open')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const unpaidInvs = DB.invoices.filter((i) => i.status === 'unpaid' || i.status === 'overdue')
    .sort((a, b) => { const da = a.due ? new Date(a.due).getTime() : Infinity; const db = b.due ? new Date(b.due).getTime() : Infinity; return da - db; });
  const clients = [...DB.clients].sort((a, b) => {
    const ta = parseInt(localStorage.getItem(`client_accessed_${a.id}`) || '0', 10);
    const tb = parseInt(localStorage.getItem(`client_accessed_${b.id}`) || '0', 10);
    return tb - ta;
  });

  // Build sorted action items: tasks first, then invoices, then notes
  const taskItems: ActionItem[] = openTasks.map((tk) => {
    const cl = DB.clients.find((c) => c.id === tk.client_id);
    return { id: tk.id, type: 'task', text: tk.content, client: cl?.company || cl?.name || '', clientId: cl?.id, age: ageDays(tk.created_at), created: tk.created_at };
  });
  const invItems: ActionItem[] = unpaidInvs.map((inv) => {
    const cl = DB.clients.find((c) => c.id === inv.clientId);
    return { id: inv.id || inv._uuid || '', type: 'invoice', text: `${currency(invTotal(inv))} ${inv.id}`, client: cl?.company || cl?.name || '', clientId: inv.clientId, age: inv.due ? Math.max(0, ageDays(inv.due)) : 0, created: inv.date };
  });
  const noteItems: ActionItem[] = openNotes.map((n) => {
    const cl = DB.clients.find((c) => c.id === n.client_id);
    return { id: n.id, type: 'note', text: n.content, client: cl?.company || cl?.name || '', clientId: cl?.id, age: ageDays(n.created_at), created: n.created_at };
  });

  const sectionLbl: React.CSSProperties = { fontSize: 11, fontWeight: 500, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 12px' };

  const renderItem = (item: ActionItem) => {
    const isTask = item.type === 'task';
    const isInv = item.type === 'invoice';
    const isNote = item.type === 'note';
    const ageColor = item.age >= 3 ? t.status.danger : item.age >= 2 ? t.status.warning : t.text.tertiary;
    const isExpanded = expandedId === item.id;

    if (isNote) {
      // Notes render as distinct blue-tinted cards
      return (
        <div key={item.id} style={{
          background: t.accent.subtle, borderLeft: `2px solid ${t.accent.primary}`,
          borderRadius: 8, padding: '10px 14px', marginBottom: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ color: t.accent.text, flexShrink: 0, marginTop: 1 }}>{ic.pencil}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: t.text.secondary, fontStyle: 'italic' }}>{item.text}</div>
              <div style={{ fontSize: 11, color: t.text.tertiary, marginTop: 3 }}>{item.client}</div>
            </div>
            <button title="Remove" onClick={() => handleTrash(item.id, item.text, 'note')} style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: t.text.tertiary, transition: 'color 150ms', flexShrink: 0,
            }} onMouseEnter={(e) => e.currentTarget.style.color = t.status.danger} onMouseLeave={(e) => e.currentTarget.style.color = t.text.tertiary}>{ic.trash}</button>
          </div>
        </div>
      );
    }

    // Tasks and invoices render as list rows
    return (
      <motion.div key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0, overflow: 'hidden' }} transition={{ duration: 0.2 }}>
        <div onClick={() => setExpandedId(isExpanded ? null : item.id)}
          style={{ padding: '12px 16px', borderBottom: `1px solid ${t.border.default}`, cursor: 'pointer', transition: 'background 150ms' }}
          onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = t.bg.surfaceHover}
          onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ color: t.text.tertiary, flexShrink: 0, marginTop: 1 }}>{isTask ? ic.checkbox : ic.receipt}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              {isInv ? (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 16, fontWeight: 500, color: t.text.primary }}>{item.text.split(' ')[0]}</span>
                  <span style={{ fontSize: 11, color: t.text.tertiary }}>{item.text.split(' ').slice(1).join(' ')} · {item.client}</span>
                  {item.age > 0 && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: t.accent.subtle, color: t.accent.text, fontWeight: 500 }}>{item.age}d</span>}
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 13, fontWeight: 500, color: t.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isExpanded ? 'normal' : 'nowrap' }}>{item.text}</div>
                  <div style={{ fontSize: 11, color: t.text.tertiary, marginTop: 2 }}>
                    {item.client}{item.age > 0 ? ' · ' : ''}{item.age > 0 && <span style={{ color: ageColor }}>{item.age}d</span>}
                  </div>
                </>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <button title="Remove" onClick={(e) => { e.stopPropagation(); handleTrash(item.id, item.text, item.type); }} style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: t.text.tertiary, transition: 'color 150ms',
              }} onMouseEnter={(e) => e.currentTarget.style.color = t.status.danger} onMouseLeave={(e) => e.currentTarget.style.color = t.text.tertiary}>{ic.trash}</button>
              <button title="Open" onClick={(e) => { e.stopPropagation(); if (item.clientId) router.push(isInv ? `/clients/${item.clientId}/invoices` : `/clients/${item.clientId}`); }} style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: t.text.tertiary, transition: 'color 150ms',
              }} onMouseEnter={(e) => e.currentTarget.style.color = t.text.primary} onMouseLeave={(e) => e.currentTarget.style.color = t.text.tertiary}>{ic.chevron}</button>
            </div>
          </div>
          <AnimatePresence>
            {isExpanded && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }}
                style={{ overflow: 'hidden', marginTop: 8, paddingTop: 8, borderTop: `0.5px solid ${t.border.default}` }}>
                {item.created && <div style={{ fontSize: 11, color: t.text.tertiary, marginBottom: 4 }}>Created: {new Date(item.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>}
                {item.clientId && <span onClick={(e) => { e.stopPropagation(); router.push(`/clients/${item.clientId}`); }} style={{ fontSize: 11, color: t.accent.text, cursor: 'pointer' }}>{item.client} →</span>}
                {isTask && <button onClick={(e) => { e.stopPropagation(); handleTrash(item.id, item.text, 'task'); }} style={{ display: 'block', marginTop: 6, fontSize: 11, fontWeight: 500, color: t.status.success, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>Mark complete</button>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    );
  };

  return (
    <div style={{ padding: 24, maxWidth: 960, minHeight: 'calc(100vh - 48px)' }}>
      <motion.div variants={stagger} initial="hidden" animate="show">

        {/* Greeting + Platform Search */}
        <motion.div variants={fadeUp} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 400, color: t.text.primary, margin: '0 0 2px', letterSpacing: '-0.01em' }}>{greeting}</h1>
            <p style={{ fontSize: 12, color: t.text.tertiary, margin: 0 }}>{dateline}</p>
          </div>
          <div ref={searchRef} style={{ position: 'relative', width: 260 }}>
            <input
              style={{ width: '100%', background: t.bg.surface, border: `0.5px solid ${searchLoading || searchResult ? '#2563eb' : t.border.default}`, borderRadius: 8, padding: '9px 14px 9px 36px', fontSize: 13, color: t.text.primary, outline: 'none', fontFamily: 'inherit', transition: 'border-color 150ms' }}
              placeholder="Search CALO&CO..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handlePlatformSearch(); if (e.key === 'Escape') { setSearchResult(null); setSearchQuery(''); } }}
              onFocus={(e) => e.currentTarget.style.borderColor = '#2563eb'}
              onBlur={(e) => { if (!searchResult && !searchLoading) e.currentTarget.style.borderColor = t.border.default; }}
            />
            <svg style={{ position: 'absolute', left: 12, top: 11, pointerEvents: 'none' }} width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#a1a1a5" strokeWidth="1.5">
              <circle cx="6.5" cy="6.5" r="5"/><line x1="10" y1="10" x2="14.5" y2="14.5"/>
            </svg>
            {(searchLoading || searchResult) && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 8, background: t.bg.surface, borderRadius: 10, padding: 16, border: `0.5px solid ${t.border.default}`, boxShadow: t.shadow.elevated, zIndex: 10 }}>
                {searchLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ position: 'relative', width: 8, height: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563eb' }} />
                      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#2563eb', animation: 'beacon-ping 1.8s ease-out infinite' }} />
                      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#2563eb', animation: 'beacon-ping-outer 1.8s ease-out 0.3s infinite' }} />
                    </div>
                    <span style={{ fontSize: 12, color: t.text.tertiary }}>Searching...</span>
                  </div>
                ) : (
                  <div style={{ animation: 'fade-in-up 300ms ease-out', position: 'relative' }}>
                    <button onClick={() => { setSearchResult(null); setSearchQuery(''); }}
                      style={{ position: 'absolute', top: -4, right: -4, width: 20, height: 20, borderRadius: '50%', background: t.bg.surfaceHover, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.text.tertiary, fontSize: 14, lineHeight: 1, padding: 0, transition: 'color 150ms' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = t.text.primary}
                      onMouseLeave={(e) => e.currentTarget.style.color = t.text.tertiary}
                      title="Dismiss">×</button>
                    <div style={{ fontSize: 13, color: t.text.primary, lineHeight: 1.5, paddingRight: 20 }}>{searchResult}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>

        {/* 3-column: Clients | Tasks & Notes | Financials */}
        <motion.div variants={fadeUp} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 200px', gap: 24 }}>

          {/* Col 1 — Clients (accordion) */}
          <div>
            <div style={sectionLbl}>Clients</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {clients.map((client) => {
                const ct = DB.contacts[client.id] || [];
                const primary = ct.find((c) => c.isPrimary) || ct[0];
                const brandColor = (typeof client.brandKit?.colors?.[0] === 'string' ? client.brandKit.colors[0] : null) || t.text.tertiary;
                const isExp = expandedClient === client.id;
                return (
                  <div key={client.id}
                    style={{ background: t.bg.surface, border: `0.5px solid ${t.border.default}`, borderRadius: 8, padding: '14px 16px', cursor: 'pointer', transition: 'transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 200ms ease, border-color 150ms' }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                    onClick={() => setExpandedClient(isExp ? null : client.id)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0, overflow: 'hidden', background: client.logo ? 'transparent' : brandColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700 }}>
                        {client.logo ? <img src={client.logo} alt="" style={{ width: 36, height: 36, objectFit: 'cover' }} /> : (client.company || client.name).charAt(0)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div onClick={(e) => { e.stopPropagation(); router.push(`/clients/${client.id}`); }}
                          style={{ fontSize: 14, fontWeight: 500, color: t.text.primary, cursor: 'pointer', transition: 'color 150ms' }}
                          onMouseEnter={(e) => e.currentTarget.style.color = t.accent.text}
                          onMouseLeave={(e) => e.currentTarget.style.color = t.text.primary}>
                          {client.company || client.name}
                        </div>
                        <div style={{ fontSize: 11, color: t.text.tertiary }}>{primary ? `${primary.name}${primary.title ? ' \u00b7 ' + primary.title : ''}` : 'No contact'}</div>
                      </div>
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#a1a1a5" strokeWidth="1.5"
                        style={{ flexShrink: 0, transform: `rotate(${isExp ? 180 : 0}deg)`, transition: 'transform 200ms' }}>
                        <path d="M4 6l4 4 4-4"/>
                      </svg>
                    </div>
                    <div style={{ overflow: 'hidden', maxHeight: isExp ? 120 : 0, opacity: isExp ? 1 : 0, transition: 'max-height 250ms ease, opacity 200ms', marginTop: isExp ? 10 : 0 }}
                      onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 46, paddingTop: 4 }}>
                        {[
                          { icon: ic.bk, href: `/clients/${client.id}/brand-kit`, label: 'Brand Kit' },
                          { icon: ic.ds, href: `/clients/${client.id}/brand-builder`, label: 'Design Studio' },
                          { icon: ic.inv, href: `/clients/${client.id}/invoices`, label: 'Invoices' },
                        ].map((btn, i) => (
                          <button key={i} onClick={() => router.push(btn.href)}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', background: 'none', border: 'none', cursor: 'pointer', color: t.text.secondary, fontSize: 13, fontWeight: 400, fontFamily: 'inherit', textAlign: 'left', transition: 'color 150ms' }}
                            onMouseEnter={(e) => e.currentTarget.style.color = t.accent.text}
                            onMouseLeave={(e) => e.currentTarget.style.color = t.text.secondary}>{btn.icon}{btn.label}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Col 2 — Tasks & Notes */}
          <div>
            <div style={sectionLbl}>Tasks & Notes</div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: t.bg.surface, border: `0.5px solid ${t.border.default}`, borderRadius: 8, padding: '12px 14px', marginBottom: 12, transition: 'border-color 150ms' }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={t.text.tertiary} strokeWidth="1.4"><path d="M8 2v12M2 8h12"/></svg>
              <input type="text" placeholder="Add a note..." value={noteInput} onChange={(e) => setNoteInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddNote(); }}
                disabled={noteSubmitting}
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: t.text.primary, fontFamily: 'inherit' }} />
            </div>

            {(taskItems.length > 0 || invItems.length > 0) && (
              <div style={{ background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: t.radius.lg, overflow: 'hidden', marginBottom: 12 }}>
                <AnimatePresence>
                  {[...taskItems, ...invItems].map(renderItem)}
                </AnimatePresence>
              </div>
            )}

            {noteItems.map(renderItem)}

            {taskItems.length === 0 && invItems.length === 0 && noteItems.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: t.text.tertiary, background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: t.radius.lg }}>All clear</div>
            )}
          </div>

          {/* Col 3 — Financials (stacked) */}
          <div>
            <div style={sectionLbl}>Financials</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Revenue (MTD)', value: currency(Math.round(animRevenue * 100) / 100), color: paidMTD > 0 ? t.status.success : t.text.secondary },
                { label: 'Outstanding', value: currency(Math.round(animOutstanding * 100) / 100), color: stats.outstanding > 0 ? t.status.warning : t.text.secondary },
                { label: 'Collected', value: currency(Math.round(animCollected * 100) / 100), color: paidMTD > 0 ? t.text.primary : t.text.secondary },
                { label: 'Active Clients', value: String(DB.clients.length), color: t.text.primary },
              ].map((m) => (
                <div key={m.label} style={{ background: t.bg.surface, borderRadius: 8, padding: 14, border: `0.5px solid ${t.border.default}` }}>
                  <div style={{ fontSize: 11, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{m.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 500, color: m.color, marginTop: 4 }}>{m.value}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <Toast
            message={`${toast.text.length > 30 ? toast.text.slice(0, 30) + '...' : toast.text} removed`}
            type="success"
            action={toast.itemType !== 'invoice' ? { label: 'Undo', onClick: handleUndo } : undefined}
            onDismiss={() => setToast(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
