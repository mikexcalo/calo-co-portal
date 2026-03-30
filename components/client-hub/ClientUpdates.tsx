'use client';

import { useState, useEffect, useCallback } from 'react';
import { loadTasksNotes, updateTaskStatus, saveTaskNote, logActivity } from '@/lib/database';

interface TaskNote {
  id: string;
  client_id: string;
  type: 'task' | 'note';
  content: string;
  status: string;
  created_at: string;
  completed_at?: string | null;
}

interface ClientUpdatesProps {
  clientId: string;
  isClient: boolean;
}

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

export default function ClientUpdates({ clientId, isClient }: ClientUpdatesProps) {
  const [items, setItems] = useState<TaskNote[]>([]);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const data = await loadTasksNotes(clientId);
    setItems(data as TaskNote[]);
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const handleSend = async () => {
    if (!message.trim()) return;
    await saveTaskNote(clientId, 'note', message.trim());
    await logActivity(clientId, 'note_added', { content: message.trim() });
    setMessage('');
    load();
  };

  const handleToggle = async (item: TaskNote) => {
    const newStatus = item.status === 'complete' ? 'open' : 'complete';
    await updateTaskStatus(item.id, newStatus);
    setItems((prev) => prev.map((i) =>
      i.id === item.id ? { ...i, status: newStatus, completed_at: newStatus === 'complete' ? new Date().toISOString() : null } : i
    ));
  };

  const sorted = [...items].sort((a, b) => {
    const ac = a.status === 'complete' ? 1 : 0;
    const bc = b.status === 'complete' ? 1 : 0;
    if (ac !== bc) return ac - bc;
    if (!ac && a.type !== b.type) return a.type === 'task' ? -1 : 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
      padding: '16px 18px', marginTop: 20,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 12 }}>
        Tasks & Notes
      </div>

      {!isClient && (
        <div style={{ display: 'flex', gap: 8, marginBottom: sorted.length > 0 ? 12 : 0 }}>
          <input
            type="text" value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
            placeholder="Add a note..."
            style={{
              flex: 1, padding: '8px 10px', fontSize: 13, border: '1px solid #e2e8f0',
              borderRadius: 8, fontFamily: 'Inter, sans-serif', color: '#1a1f2e',
            }}
          />
          <button onClick={handleSend} className="cta-btn" style={{ height: 36, fontSize: 12, padding: '0 14px' }}>
            Add
          </button>
        </div>
      )}

      {sorted.length === 0 ? (
        <div style={{ fontSize: 12, color: '#94a3b8', padding: '4px 0' }}>No tasks or notes yet</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sorted.map((item) => {
            const isComplete = item.status === 'complete';
            return (
              <div key={item.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                padding: '6px 8px', background: '#f8fafc', borderRadius: 6,
                opacity: isComplete ? 0.5 : 1,
              }}>
                {item.type === 'task' ? (
                  <input
                    type="checkbox" checked={isComplete}
                    onChange={() => handleToggle(item)}
                    style={{ marginTop: 2, cursor: 'pointer', flexShrink: 0 }}
                  />
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" style={{ marginTop: 2, flexShrink: 0 }}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: 13, color: '#334155', lineHeight: 1.4,
                    textDecoration: isComplete ? 'line-through' : 'none',
                  }}>
                    {item.content}
                  </div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>
                    {relativeTime(item.created_at)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
