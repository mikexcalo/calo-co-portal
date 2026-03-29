'use client';

import { useState, useEffect } from 'react';

interface Update {
  id: string;
  message: string;
  timestamp: string;
  from: string;
}

interface ClientUpdatesProps {
  clientId: string;
  isClient: boolean;
}

function getUpdates(clientId: string): Update[] {
  try {
    const raw = localStorage.getItem(`client_updates_${clientId}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveUpdates(clientId: string, updates: Update[]) {
  localStorage.setItem(`client_updates_${clientId}`, JSON.stringify(updates));
}

export default function ClientUpdates({ clientId, isClient }: ClientUpdatesProps) {
  const [updates, setUpdates] = useState<Update[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setUpdates(getUpdates(clientId));
  }, [clientId]);

  const handleSend = () => {
    if (!message.trim()) return;
    const newUpdate: Update = {
      id: Date.now().toString(),
      message: message.trim(),
      timestamp: new Date().toISOString(),
      from: 'CALO&CO',
    };
    const next = [newUpdate, ...updates];
    setUpdates(next);
    saveUpdates(clientId, next);
    setMessage('');
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
      ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 18px',
      marginTop: 20,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 12 }}>
        Updates
      </div>

      {/* Send input — agency only */}
      {!isClient && (
        <div style={{ display: 'flex', gap: 8, marginBottom: updates.length > 0 ? 14 : 0 }}>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
            placeholder="Send an update to this client..."
            style={{
              flex: 1, padding: '8px 10px', fontSize: 13, border: '1px solid #e2e8f0',
              borderRadius: 8, fontFamily: 'Inter, sans-serif', color: '#1a1f2e',
            }}
          />
          <button onClick={handleSend} className="cta-btn" style={{ height: 36, fontSize: 12, padding: '0 14px' }}>
            Send
          </button>
        </div>
      )}

      {/* Feed */}
      {updates.length === 0 ? (
        <div style={{ fontSize: 12, color: '#94a3b8', padding: '4px 0' }}>No updates yet</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {updates.slice(0, 10).map((u) => (
            <div key={u.id} style={{
              padding: '8px 10px', background: '#f8fafc', borderRadius: 8,
              border: '1px solid #f1f5f9',
            }}>
              <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.4 }}>{u.message}</div>
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4, display: 'flex', gap: 6 }}>
                <span style={{ fontWeight: 600, color: '#64748b' }}>from {u.from}</span>
                <span>{formatTime(u.timestamp)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
