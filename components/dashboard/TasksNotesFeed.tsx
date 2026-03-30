'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { DB, loadTasksNotes, updateTaskStatus, deleteTaskNote } from '@/lib/database';
import TaskNoteCard from '@/components/shared/TaskNoteCard';

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

  const load = useCallback(async () => {
    const data = await loadTasksNotes();
    setItems(data as TaskNote[]);
    setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  const handleToggle = async (item: TaskNote) => {
    const ns = item.status === 'complete' ? 'open' : 'complete';
    await updateTaskStatus(item.id, ns);
    setItems((prev) => prev.map((i) =>
      i.id === item.id ? { ...i, status: ns, completed_at: ns === 'complete' ? new Date().toISOString() : null } : i
    ));
  };

  // Filter out invoice notification notes — only show tasks and regular notes
  const filtered = items.filter((i) => !(i.type === 'note' && i.content.startsWith('New invoice #')));

  const sorted = [...filtered].sort((a, b) => {
    const ac = a.status === 'complete' ? 1 : 0;
    const bc = b.status === 'complete' ? 1 : 0;
    if (ac !== bc) return ac - bc;
    if (!ac && a.type !== b.type) return a.type === 'task' ? -1 : 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const activityItems = DB.activityLog
    .filter((e) => ['invoice_created', 'invoice_paid', 'client_added', 'contact_saved', 'brand_guide_exported'].includes(e.eventType))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const evLabels: Record<string, string> = {
    invoice_created: 'Invoice Created', invoice_paid: 'Invoice Paid',
    client_added: 'Client Added', contact_saved: 'Contact Saved',
    brand_guide_exported: 'Brand Guide Exported',
  };

  return (
    <div>
      <div className="section-title" style={{ marginBottom: 10 }}>Tasks & Notes</div>

      {!loaded ? (
        <div style={{ fontSize: 12, color: '#94a3b8', padding: 4 }}>Loading...</div>
      ) : sorted.length === 0 && activityItems.length === 0 ? (
        <div style={{ fontSize: 12, color: '#94a3b8', padding: '8px 2px', lineHeight: 1.5 }}>
          Notes and tasks from the AI bar will appear here.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {sorted.map((item) => {
            const client = DB.clients.find((c) => c.id === item.client_id);
            return (
              <TaskNoteCard
                key={item.id}
                item={item}
                clientName={client?.company || client?.name}
                onToggle={() => handleToggle(item)}
                onDelete={async () => { await deleteTaskNote(item.id); load(); }}
              />
            );
          })}

          {/* Recent Activity — muted card */}
          {activityItems.length > 0 && (
            <div style={{
              background: '#f8fafc', borderRadius: 10, padding: '12px 14px', marginTop: 10,
            }}>
              <div style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase',
                color: '#cbd5e1', marginBottom: 6,
              }}>Recent Activity</div>
              {activityItems.map((ev, idx) => {
                const cl = DB.clients.find((c) => c.id === ev.clientId);
                const clientName = cl?.company || cl?.name || '';
                return (
                  <div key={idx} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '3px 0', fontSize: 11, color: '#94a3b8',
                  }}>
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#d1d5db', flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>
                      {evLabels[ev.eventType] || ev.eventType}
                      {cl && (
                        <>
                          {' · '}
                          <span
                            onClick={() => router.push(`/clients/${cl.id}`)}
                            style={{ textDecoration: 'underline', cursor: 'pointer', color: '#64748b' }}
                          >{clientName}</span>
                        </>
                      )}
                    </span>
                    <span style={{ fontSize: 10, flexShrink: 0 }}>{relativeTime(ev.createdAt)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
