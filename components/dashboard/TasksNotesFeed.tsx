'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { DB, loadTasksNotes, updateTaskStatus, deleteTaskNote } from '@/lib/database';
import { currency } from '@/lib/utils';

interface TaskNote {
  id: string; client_id: string; type: 'task' | 'note'; content: string;
  status: string; created_at: string; completed_at?: string | null;
}

interface TasksNotesFeedProps { refreshKey?: number; }

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Shorten company name — first 1-2 meaningful words */
function shortName(full: string): string {
  if (!full) return '';
  // Remove common suffixes
  const cleaned = full.replace(/\s+(Inc\.?|LLC|Co\.?|Corp\.?|Ltd\.?|Installation|Construction|Store)$/i, '').trim();
  const words = cleaned.split(/\s+/);
  // Keep first 2 words max, or first word if it's already distinctive
  return words.slice(0, 2).join(' ');
}

/** Format date as short month + day, no year */
function shortDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return dateStr; }
}

export default function TasksNotesFeed({ refreshKey }: TasksNotesFeedProps) {
  const router = useRouter();
  const [items, setItems] = useState<TaskNote[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [delHover, setDelHover] = useState<string | null>(null);
  const [fadingId, setFadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await loadTasksNotes();
    setItems(data as TaskNote[]);
    setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  const handleComplete = async (id: string) => {
    setFadingId(id);
    await updateTaskStatus(id, 'complete');
    setTimeout(() => { setItems((prev) => prev.filter((i) => i.id !== id)); setFadingId(null); }, 300);
  };

  const handleDelete = async (id: string) => {
    await deleteTaskNote(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  // Tasks by created_at desc, invoices by due asc, tasks above invoices
  const openTasks = items
    .filter((i) => i.type === 'task' && i.status === 'open')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const unpaidInvoices = DB.invoices
    .filter((i) => i.status === 'unpaid' || i.status === 'overdue')
    .sort((a, b) => {
      const da = a.due ? new Date(a.due).getTime() : Infinity;
      const db = b.due ? new Date(b.due).getTime() : Infinity;
      return da - db;
    });

  // Recent Activity — max 3 (#6)
  const activityItems = DB.activityLog
    .filter((e) => ['invoice_created', 'invoice_paid', 'client_added', 'contact_saved', 'brand_guide_exported', 'task_added', 'note_added'].includes(e.eventType))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3);

  const evLabels: Record<string, string> = {
    invoice_created: 'Invoice Created', invoice_paid: 'Invoice Paid',
    client_added: 'Client Added', contact_saved: 'Contact Saved',
    brand_guide_exported: 'Brand Guide Exported', task_added: 'Task Added', note_added: 'Note Added',
  };

  const hasItems = openTasks.length > 0 || unpaidInvoices.length > 0;

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 8 }}>Action Items</div>

      {!loaded ? (
        <div style={{ fontSize: 12, color: '#9ca3af', padding: 4 }}>Loading...</div>
      ) : !hasItems ? (
        <div style={{ fontSize: 12, color: '#9ca3af', padding: '8px 2px', lineHeight: 1.5 }}>No action items right now.</div>
      ) : (
        <div>
          {/* Task cards — amber square icons (#5) */}
          {openTasks.map((task) => {
            const cl = DB.clients.find((c) => c.id === task.client_id);
            const sn = shortName(cl?.company || cl?.name || '');
            return (
              <div key={task.id} style={{
                background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
                padding: '12px 14px', marginBottom: 10, display: 'flex', alignItems: 'flex-start', gap: 10,
                opacity: fadingId === task.id ? 0 : 1, transition: 'opacity 0.3s ease',
              }}>
                <div onClick={() => handleComplete(task.id)} style={{
                  width: 24, height: 24, borderRadius: 6, background: '#faeeda',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#854f0b" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="m9 12 2 2 4-4"/></svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: '#1a1f2e', lineHeight: 1.4 }}>{task.content}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>
                    {sn && <span onClick={() => router.push(`/clients/${task.client_id}`)} style={{ cursor: 'pointer', color: '#6b7280' }}>{sn}</span>}
                    {sn && ' · '}{relativeTime(task.created_at)}
                  </div>
                </div>
                <div
                  onClick={() => { if (confirm('Delete this task?')) handleDelete(task.id); }}
                  onMouseEnter={() => setDelHover(task.id)}
                  onMouseLeave={() => setDelHover(null)}
                  style={{ cursor: 'pointer', opacity: delHover === task.id ? 1 : 0.25, transition: 'opacity 0.12s', flexShrink: 0, marginTop: 2 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </div>
              </div>
            );
          })}

          {/* Invoice cards — white, no colored bg (#7) */}
          {unpaidInvoices.map((inv) => {
            const cl = DB.clients.find((c) => c.id === inv.clientId);
            const sn = shortName(cl?.company || cl?.name || '');
            const total = (inv.items || []).reduce((s: number, i: any) => s + (i.qty || 1) * (i.price || 0), 0) + (inv.tax || 0) + (inv.shipping || 0);
            return (
              <div key={inv.id || inv._uuid} onClick={() => router.push(`/clients/${inv.clientId}/invoices`)} style={{
                background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
                padding: '12px 14px', marginBottom: 10, display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
              }}>
                <div style={{
                  width: 24, height: 24, borderRadius: 6, background: '#e6f1fb',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#185fa5" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: '#1a1f2e' }}>{currency(total)} <span style={{ color: '#ba7517' }}>unpaid</span>{inv.due ? ` · due ${shortDate(inv.due)}` : ''}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>{sn}{sn && ' · '}{inv.id}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Recent Activity — max 3, no underlines, muted (#6) */}
      {activityItems.length > 0 && (
        <div style={{ background: '#f4f5f7', borderRadius: 10, padding: '12px 14px', marginTop: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 6 }}>Recent Activity</div>
          {activityItems.map((ev, idx) => {
            const cl = DB.clients.find((c) => c.id === ev.clientId);
            const sn = shortName(cl?.company || cl?.name || '');
            return (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', fontSize: 12, color: '#9ca3af' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#d1d5db', flexShrink: 0 }} />
                <span style={{ flex: 1 }}>
                  {evLabels[ev.eventType] || ev.eventType}
                  {sn && ` · `}
                  {sn && <span style={{ color: '#6b7280' }}>{sn}</span>}
                </span>
                <span style={{ fontSize: 11, flexShrink: 0 }}>{relativeTime(ev.createdAt)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
