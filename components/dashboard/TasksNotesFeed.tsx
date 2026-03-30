'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { DB, loadTasksNotes, updateTaskStatus } from '@/lib/database';

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
    console.log('[TasksNotesFeed] Loading...');
    const data = await loadTasksNotes();
    console.log('[TasksNotesFeed] Loaded:', data.length);
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

  const sorted = [...items].sort((a, b) => {
    const ac = a.status === 'complete' ? 1 : 0;
    const bc = b.status === 'complete' ? 1 : 0;
    if (ac !== bc) return ac - bc;
    if (!ac && a.type !== b.type) return a.type === 'task' ? -1 : 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // Activity log — dimmed secondary section (#5)
  const activityItems = DB.activityLog
    .filter((e) => ['invoice_created', 'invoice_paid', 'client_added', 'contact_saved', 'brand_guide_exported'].includes(e.eventType))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const evLabels: Record<string, string> = {
    invoice_created: 'Invoice Created', invoice_paid: 'Invoice Paid',
    client_added: 'Client Added', contact_saved: 'Contact Saved',
    brand_guide_exported: 'Brand Guide Exported',
  };

  // Left border color per item type (#4)
  const borderColor = (item: TaskNote) => {
    if (item.type === 'task' && item.status === 'complete') return '#22c55e';
    if (item.type === 'task') return '#f59e0b';
    return '#3b82f6';
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
            const clientName = client?.company || client?.name || '';
            const isComplete = item.status === 'complete';

            return (
              <div key={item.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                padding: '7px 10px', background: '#fff',
                border: '1px solid #e2e8f0', borderLeft: `3px solid ${borderColor(item)}`,
                borderRadius: 6, opacity: isComplete ? 0.5 : 1,
              }}>
                {item.type === 'task' ? (
                  <input type="checkbox" checked={isComplete} onChange={() => handleToggle(item)}
                    style={{ marginTop: 2, cursor: 'pointer', flexShrink: 0 }} />
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" style={{ marginTop: 2, flexShrink: 0 }}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12, color: '#334155', lineHeight: 1.4,
                    textDecoration: isComplete ? 'line-through' : 'none',
                  }}>{item.content}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                    {clientName && (
                      <span onClick={() => router.push(`/clients/${item.client_id}`)} style={{
                        fontSize: 10, padding: '1px 6px', borderRadius: 4,
                        background: '#eff6ff', color: '#2563eb', fontWeight: 500, cursor: 'pointer',
                      }}>{clientName}</span>
                    )}
                    <span style={{ fontSize: 10, color: '#94a3b8' }}>{relativeTime(item.created_at)}</span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Recent Activity — dimmed sub-section (#5) */}
          {activityItems.length > 0 && (
            <>
              <div style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase',
                color: '#cbd5e1', marginTop: 10, marginBottom: 2,
              }}>Recent Activity</div>
              {activityItems.map((ev, idx) => {
                const cl = DB.clients.find((c) => c.id === ev.clientId);
                return (
                  <div key={idx} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '4px 0', fontSize: 11, color: '#94a3b8',
                  }}>
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#d1d5db', flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>
                      {evLabels[ev.eventType] || ev.eventType}
                      {cl ? ` · ${cl.company || cl.name}` : ''}
                    </span>
                    <span style={{ fontSize: 10, flexShrink: 0 }}>{relativeTime(ev.createdAt)}</span>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
