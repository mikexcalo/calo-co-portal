'use client';

import { useState, useEffect, useCallback } from 'react';
import { loadTasksNotes, updateTaskStatus, saveTaskNote, logActivity } from '@/lib/database';
import TaskNoteCard from '@/components/shared/TaskNoteCard';

interface TaskNote {
  id: string; client_id: string; type: 'task' | 'note'; content: string;
  status: string; created_at: string; completed_at?: string | null;
}

interface ClientUpdatesProps {
  clientId: string;
  isClient: boolean;
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
    await logActivity(clientId, 'note_added', { content: message.trim() }).catch(() => {});
    setMessage('');
    load();
  };

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
          <input type="text" value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
            placeholder="Add a note..."
            style={{
              flex: 1, padding: '8px 10px', fontSize: 13, border: '1px solid #e2e8f0',
              borderRadius: 8, fontFamily: 'Inter, sans-serif', color: '#1a1f2e',
            }} />
          <button onClick={handleSend} className="cta-btn" style={{ height: 36, fontSize: 12, padding: '0 14px' }}>Add</button>
        </div>
      )}

      {sorted.length === 0 ? (
        <div style={{ fontSize: 12, color: '#94a3b8', padding: '4px 0' }}>No tasks or notes yet</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {sorted.map((item) => (
            <TaskNoteCard
              key={item.id}
              item={item}
              showClient={false}
              onToggle={() => handleToggle(item)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
