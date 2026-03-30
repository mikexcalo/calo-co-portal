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

export default function TasksNotesFeed({ refreshKey }: TasksNotesFeedProps) {
  const router = useRouter();
  const [items, setItems] = useState<TaskNote[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [delHover, setDelHover] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await loadTasksNotes();
    setItems(data as TaskNote[]);
    setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  const handleComplete = async (id: string) => {
    await updateTaskStatus(id, 'complete');
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleDelete = async (id: string) => {
    await deleteTaskNote(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  // Open tasks only for action items
  const openTasks = items.filter((i) => i.type === 'task' && i.status === 'open');
  // Unpaid invoices across all clients
  const unpaidInvoices = DB.invoices.filter((i) => i.status === 'unpaid' || i.status === 'overdue');

  // Activity log
  const activityItems = DB.activityLog
    .filter((e) => ['invoice_created', 'invoice_paid', 'client_added', 'contact_saved', 'brand_guide_exported', 'task_added', 'note_added'].includes(e.eventType))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);

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
        <div style={{ fontSize: 12, color: '#9ca3af', padding: '8px 2px', lineHeight: 1.5 }}>
          No action items right now.
        </div>
      ) : (
        <div>
          {/* Task cards */}
          {openTasks.map((task) => {
            const cl = DB.clients.find((c) => c.id === task.client_id);
            const clientName = cl?.company || cl?.name || '';
            return (
              <div key={task.id} style={{
                background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
                padding: '12px 14px', marginBottom: 8, display: 'flex', alignItems: 'flex-start', gap: 10,
              }}>
                {/* Amber checkbox icon */}
                <div onClick={() => handleComplete(task.id)} style={{
                  width: 24, height: 24, borderRadius: 6, background: '#faeeda',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#854f0b" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: '#1a1f2e', lineHeight: 1.4 }}>{task.content}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>
                    {clientName && <span onClick={() => router.push(`/clients/${task.client_id}`)} style={{ cursor: 'pointer', textDecoration: 'underline' }}>{clientName}</span>}
                    {clientName && ' · '}{relativeTime(task.created_at)}
                  </div>
                </div>
                {/* Trash icon */}
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

          {/* Invoice cards */}
          {unpaidInvoices.map((inv) => {
            const cl = DB.clients.find((c) => c.id === inv.clientId);
            const clientName = cl?.company || cl?.name || '';
            const total = (inv.items || []).reduce((s: number, i: any) => s + (i.qty || 1) * (i.price || 0), 0) + (inv.tax || 0) + (inv.shipping || 0);
            return (
              <div key={inv.id || inv._uuid} onClick={() => router.push(`/clients/${inv.clientId}/invoices`)} style={{
                background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
                padding: '12px 14px', marginBottom: 8, display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
              }}>
                <div style={{
                  width: 24, height: 24, borderRadius: 6, background: '#e6f1fb',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#185fa5" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: '#1a1f2e' }}>#{inv.id} — {currency(total)} · <span style={{ color: '#ba7517' }}>Unpaid</span></div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>{clientName}{inv.due ? ` · Due ${inv.due}` : ''}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Recent Activity */}
      {activityItems.length > 0 && (
        <div style={{ background: '#f4f5f7', borderRadius: 10, padding: '12px 14px', marginTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 6 }}>Recent Activity</div>
          {activityItems.map((ev, idx) => {
            const cl = DB.clients.find((c) => c.id === ev.clientId);
            const clientName = cl?.company || cl?.name || '';
            return (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', fontSize: 12, color: '#9ca3af' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#d1d5db', flexShrink: 0 }} />
                <span style={{ flex: 1 }}>
                  {evLabels[ev.eventType] || ev.eventType}
                  {cl && <>{' · '}<span onClick={() => router.push(`/clients/${cl.id}`)} style={{ textDecoration: 'underline', cursor: 'pointer', color: '#6b7280' }}>{clientName}</span></>}
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
