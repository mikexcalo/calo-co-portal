'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface TaskNoteCardProps {
  item: {
    id: string;
    client_id: string;
    type: 'task' | 'note';
    content: string;
    status: string;
    created_at: string;
  };
  clientName?: string;
  showClient?: boolean;
  onToggle?: () => void;
  onDelete?: () => void;
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

function isInvoiceNote(content: string): boolean {
  return content.startsWith('New invoice #');
}

export default function TaskNoteCard({ item, clientName, showClient = true, onToggle, onDelete }: TaskNoteCardProps) {
  const router = useRouter();
  const [delHover, setDelHover] = useState(false);
  const isComplete = item.status === 'complete';
  const isInvoice = item.type === 'note' && isInvoiceNote(item.content);

  const iconColor = '#6b7280';

  const handleContentClick = () => {
    if (isInvoice) router.push(`/clients/${item.client_id}/invoices`);
  };

  const handleDelete = () => {
    if (onDelete && confirm('Delete this item?')) onDelete();
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10, position: 'relative',
      padding: '10px 14px', background: '#ffffff',
      border: '0.5px solid #e5e7eb',
      borderRadius: 6, opacity: isComplete ? 0.5 : 1,
      marginBottom: 6,
    }}>
      {/* Icon */}
      {item.type === 'task' ? (
        <input type="checkbox" checked={isComplete} onChange={() => onToggle?.()}
          style={{ marginTop: 2, cursor: 'pointer', flexShrink: 0, accentColor: iconColor }} />
      ) : isInvoice ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" style={{ marginTop: 2, flexShrink: 0 }}>
          <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" style={{ marginTop: 2, flexShrink: 0 }}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p onClick={isInvoice ? handleContentClick : undefined} style={{
          fontSize: 13, fontWeight: 500, color: isComplete ? '#9ca3af' : '#111827',
          margin: '0 0 2px', lineHeight: 1.4,
          textDecoration: isComplete ? 'line-through' : 'none',
          cursor: isInvoice ? 'pointer' : 'default',
        }}>{item.content}</p>
        <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>
          {showClient && clientName && <span onClick={() => router.push(`/clients/${item.client_id}`)} style={{ cursor: 'pointer', color: '#6b7280' }}>{clientName} · </span>}
          {relativeTime(item.created_at)}
        </p>
      </div>
      {/* Delete button */}
      {onDelete && (
        <button
          onClick={handleDelete}
          onMouseEnter={() => setDelHover(true)}
          onMouseLeave={() => setDelHover(false)}
          style={{
            position: 'absolute', top: 4, right: 4,
            background: 'none', border: 'none', cursor: 'pointer', padding: 2,
            color: delHover ? '#ef4444' : '#cbd5e1', transition: 'color 0.12s',
          }}
          title="Delete"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      )}
    </div>
  );
}
