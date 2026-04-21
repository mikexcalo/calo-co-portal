'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  initSupabase, initAgency, loadClients, loadInvoices, loadContacts,
  loadAllBrandKits, loadActivityLog, loadExpenses, loadAgencySettings,
  loadTasksNotes, DB, updateTaskStatus, deleteInvoice, saveTaskNote,
} from '@/lib/database';
import { agencyStats, currency, invTotal } from '@/lib/utils';
import { getClientAvatarUrl } from '@/lib/clientAvatar';
import CommandBar from '@/components/dashboard/CommandBar';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/lib/theme';
import HelmSpinner from '@/components/shared/HelmSpinner';
import Toast from '@/components/shared/Toast';
import useCountUp from '@/lib/useCountUp';
import { PageShell, PageHeader, StatRow, DataCard, SectionLabel, TableRow, TableCell, GhostButton } from '@/components/shared/Brand';
import { StatusPill } from '@/components/shared/StatusPill';
import TaskNoteCard from '@/components/shared/TaskNoteCard';

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

function getNoteUrgency(text: string, createdAt: string): 'overdue' | 'due-today' | 'normal' {
  const lower = text.toLowerCase();
  const now = new Date();
  const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const todayIndex = now.getDay();
  for (let i = 0; i < dayNames.length; i++) {
    if (lower.includes(dayNames[i])) {
      if (i === todayIndex) return 'due-today';
      const created = new Date(createdAt);
      const daysSinceCreated = Math.floor((now.getTime() - created.getTime()) / 86400000);
      if (daysSinceCreated >= 7) return 'overdue';
      const daysUntil = (i - todayIndex + 7) % 7;
      if (daysUntil > 4) return 'overdue';
    }
  }
  return 'normal';
}

export default function Home() {
  const router = useRouter();
  const { t, theme: themeName } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [greeting, setGreeting] = useState('Good morning');
  const [dateline, setDateline] = useState('');
  const [stats, setStats] = useState(agencyStats([], []));
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [toast, setToast] = useState<{ id: string; text: string; itemType: 'task' | 'invoice' | 'note' } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState('');
  const noteInputRef = useRef<HTMLInputElement>(null);
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [taskInput, setTaskInput] = useState('');
  const taskInputRef = useRef<HTMLInputElement>(null);
  const [taskSubmitting, setTaskSubmitting] = useState(false);

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

  const handleAddTask = async () => {
    const text = taskInput.trim();
    if (!text || taskSubmitting) return;
    setTaskSubmitting(true);
    try {
      const clientId = DB.clients[0]?.id;
      if (clientId) {
        await saveTaskNote(clientId, 'task', text);
        setAllTasks(await loadTasksNotes());
      }
      setTaskInput('');
    } catch (e) { console.error('Failed to add task:', e); }
    finally { setTaskSubmitting(false); }
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

  if (isLoading) return null;

  const awaitingInvs = DB.invoices.filter((i) => i.status === 'unpaid' || i.status === 'overdue');

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
    return { id: n.id, type: 'note' as const, text: n.content, client: cl?.company || cl?.name || '', clientId: cl?.id, age: ageDays(n.created_at), created: n.created_at };
  }).sort((a, b) => {
    const urgencyOrder = { overdue: 0, 'due-today': 1, normal: 2 };
    const ua = urgencyOrder[getNoteUrgency(a.text, a.created || '')];
    const ub = urgencyOrder[getNoteUrgency(b.text, b.created || '')];
    return ua !== ub ? ua - ub : (b.age - a.age);
  });

  const renderItem = (item: ActionItem) => {
    const isTask = item.type === 'task';
    const isInv = item.type === 'invoice';
    const isNote = item.type === 'note';
    const ageColor = item.age >= 3 ? t.status.danger : item.age >= 2 ? t.status.warning : t.text.tertiary;
    const isExpanded = expandedId === item.id;

    if (isNote) {
      const urg = getNoteUrgency(item.text, item.created || '');
      const urgColor = urg === 'overdue' ? '#E24B4A' : urg === 'due-today' ? '#f59e0b' : '#2563eb';
      const urgLabel = urg === 'overdue' ? 'Overdue' : urg === 'due-today' ? 'Due today' : null;
      const ageText = item.age === 0 ? 'Today' : item.age === 1 ? '1 day ago' : `${item.age} days ago`;
      return (
        <div key={item.id} style={{ background: t.bg.surface, border: `1px solid ${t.border.default}`, borderLeft: `3px solid ${urgColor}`, borderRadius: '0 8px 8px 0', padding: '8px 12px', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={t.text.tertiary} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
              <path d="M1.5 2.5h13c.6 0 1 .4 1 1v7c0 .6-.4 1-1 1H11l-3 3-3-3H1.5c-.6 0-1-.4-1-1v-7c0-.6.4-1 1-1z"/>
            </svg>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: t.text.primary, marginBottom: 5, lineHeight: '1.45' }}>{item.text}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 10, color: t.text.tertiary }}>{item.client}</span>
                <span style={{ fontSize: 8, color: t.text.tertiary }}>·</span>
                {urgLabel
                  ? <span style={{ fontSize: 10, color: urgColor, fontWeight: 500 }}>{urgLabel}</span>
                  : <span style={{ fontSize: 10, color: t.text.tertiary }}>{ageText}</span>
                }
              </div>
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
    <PageShell>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{
            fontSize: 34,
            fontWeight: 400,
            margin: '0 0 4px',
            color: t.text.primary,
            letterSpacing: '-0.5px',
            lineHeight: 1.1,
          }}>
            {greeting}
          </h1>
          <p style={{ fontSize: 13, color: t.text.secondary, margin: 0 }}>
            {DB.clients.length} {DB.clients.length === 1 ? 'client' : 'clients'} on deck
            {awaitingInvs.length > 0 && (
              <>
                {' \u00b7 '}
                <span style={{ color: '#8B6F47' }}>
                  {awaitingInvs.length === 1 ? '1 invoice' : `${awaitingInvs.length} invoices`} awaiting payment
                </span>
              </>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => router.push('/clients/new')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: t.bg.surface,
              color: t.text.primary,
              border: `0.5px solid ${t.border.default}`,
              borderRadius: 8,
              padding: '7px 14px',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'background 150ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = t.bg.surfaceHover; }}
            onMouseLeave={e => { e.currentTarget.style.background = t.bg.surface; }}
          >
            + New client
          </button>
          <button
            onClick={() => { if (DB.clients[0]) router.push(`/clients/${DB.clients[0].id}/invoices/new`); }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: t.text.primary,
              color: t.text.inverse,
              border: `0.5px solid ${t.text.primary}`,
              borderRadius: 8,
              padding: '7px 14px',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            + Invoice
          </button>
        </div>
      </motion.div>

      {/* Alert band — awaiting payment > drafts */}
      {(() => {
        const draftInvs = DB.invoices.filter(inv => inv.status === 'draft');
        const awaitingInvs = DB.invoices.filter(inv => inv.status === 'unpaid' || inv.status === 'overdue');

        if (awaitingInvs.length > 0) {
          const first = awaitingInvs[0];
          const cl = DB.clients.find(c => c.id === first.clientId);
          const count = awaitingInvs.length === 1 ? '1 invoice awaiting payment' : `${awaitingInvs.length} invoices awaiting payment`;
          const detail = awaitingInvs.length === 1
            ? `${first.id} · ${cl?.company || cl?.name || 'Client'} · ${currency(invTotal(first))}`
            : `${first.id} and ${awaitingInvs.length - 1} more`;
          return (
            <div style={{ marginBottom: 16 }}>
              <div onClick={() => router.push('/invoices')}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px', background: 'rgba(139,111,71,0.07)', borderLeft: '3px solid #8B6F47', borderRadius: 6, cursor: 'pointer', transition: 'background 120ms' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(139,111,71,0.11)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(139,111,71,0.07)'; }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0, flex: 1 }}>
                  <div style={{ color: '#8B6F47', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>{count}</div>
                  <div style={{ color: t.text.secondary, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detail}</div>
                </div>
                <span style={{ color: '#8B6F47', fontSize: 18, lineHeight: 1, flexShrink: 0 }}>→</span>
              </div>
            </div>
          );
        }

        if (draftInvs.length > 0) {
          const first = draftInvs[0];
          const firstCl = DB.clients.find(c => c.id === first.clientId);
          const heading = draftInvs.length === 1 ? '1 invoice ready to send' : `${draftInvs.length} invoices ready to send`;
          const detail = draftInvs.length === 1
            ? `${first.id} · ${firstCl?.company || firstCl?.name || 'Client'} · ${currency(invTotal(first))}`
            : `${first.id} and ${draftInvs.length - 1} more`;
          return (
            <div style={{ marginBottom: 16 }}>
              <div onClick={() => router.push('/invoices')}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px', background: 'rgba(0,106,255,0.06)', borderLeft: `3px solid ${t.accent.primary}`, borderRadius: 6, cursor: 'pointer', transition: 'background 120ms' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,106,255,0.10)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,106,255,0.06)'; }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0, flex: 1 }}>
                  <div style={{ color: t.accent.primary, fontSize: 13, fontWeight: 600, flexShrink: 0 }}>{heading}</div>
                  <div style={{ color: t.text.secondary, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detail}</div>
                </div>
                <span style={{ color: t.accent.primary, fontSize: 18, lineHeight: 1, flexShrink: 0 }}>→</span>
              </div>
            </div>
          );
        }

        return null;
      })()}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        {/* LEFT COLUMN: Ask + Recent Clients */}
        <div>
          <div style={{ marginBottom: 16 }}>
            <CommandBar
              onItemSaved={refreshFeed}
              variant="ask"
              placeholder="Ask Helm anything..."
            />
          </div>
          <SectionLabel>Recent Clients</SectionLabel>
          <DataCard noPadding>
            {clients.slice(0, 5).map((client) => {
              const ct = DB.contacts[client.id] || [];
              const primary = ct.find((c) => c.isPrimary) || ct[0];
              const clientInvs = DB.invoices.filter((i) => i.clientId === client.id);
              const clientOutstanding = clientInvs.filter((i) => i.status === 'unpaid' || i.status === 'overdue').reduce((s, i) => s + invTotal(i), 0);
              const clientTasks = allTasks.filter((tk) => tk.client_id === client.id);
              const now = Date.now();
              const sevenDays = 7 * 86400000;
              const recentActivity = clientTasks.some((tk) => now - new Date(tk.created_at).getTime() < sevenDays)
                || clientInvs.some((i) => i.date && now - new Date(i.date).getTime() < sevenDays);
              const engStatus = (client as any).engagementStatus || 'active';
              const avatarUrl = getClientAvatarUrl(client);

              return (
                <TableRow key={client.id} onClick={() => router.push(`/clients/${client.id}`)}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, overflow: 'hidden', background: avatarUrl ? 'transparent' : t.bg.surfaceHover, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: t.text.secondary, flexShrink: 0, marginRight: 12 }}>
                    {avatarUrl
                      ? <img src={avatarUrl} alt="" style={{ width: 32, height: 32, objectFit: 'contain' }} />
                      : (client.company || client.name || '').charAt(0)
                    }
                  </div>
                  <TableCell primary flex={2}>{client.company || client.name}</TableCell>
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <StatusPill status={engStatus as any} />
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke={t.text.tertiary} strokeWidth="1.5"><path d="M6 4l4 4-4 4"/></svg>
                  </div>
                </TableRow>
              );
            })}
            <div style={{ padding: '12px 16px', textAlign: 'center' }}>
              <span onClick={() => router.push('/clients')} style={{ fontSize: 12, color: t.accent.text, cursor: 'pointer' }}>View all clients →</span>
            </div>
          </DataCard>
        </div>

        {/* RIGHT COLUMN: Tasks & Notes */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '0.5px', margin: '0 0 8px' }}>Tasks & Notes</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input
              type="text"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddNote(); }}
              placeholder="Add a note..."
              style={{ flex: 1, padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', color: '#1a1f2e', outline: 'none' }}
            />
            <button onClick={handleAddNote} disabled={noteSubmitting || !noteInput.trim()} style={{
              height: 36, fontSize: 12, padding: '0 14px', background: '#006AFF', color: '#fff',
              border: 'none', borderRadius: 8, fontWeight: 500, cursor: noteSubmitting || !noteInput.trim() ? 'default' : 'pointer',
              fontFamily: 'inherit', opacity: noteSubmitting || !noteInput.trim() ? 0.5 : 1,
            }}>Add</button>
          </div>
          {openNotes.length > 0 ? (
            openNotes.slice(0, 5).map((note) => {
              const cl = DB.clients.find((c) => c.id === note.client_id);
              return (
                <TaskNoteCard
                  key={note.id}
                  item={note}
                  clientName={cl?.company || cl?.name || ''}
                  showClient={true}
                  onDelete={() => handleTrash(note.id, note.content, 'note')}
                />
              );
            })
          ) : (
            <div style={{ fontSize: 13, color: '#9ca3af', padding: '12px 4px' }}>No notes yet. Type above to capture one.</div>
          )}
        </div>
      </div>

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
    </PageShell>
  );
}
