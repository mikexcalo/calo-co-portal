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

  let bg: string, borderColor: string, iconColor: string;
  if (isInvoice) {
    bg = isComplete ? '#f9fafb' : '#f0fdf4';
    borderColor = '#22c55e'; iconColor = '#22c55e';
  } else if (item.type === 'task') {
    bg = isComplete ? '#f9fafb' : '#fffbeb';
    borderColor = isComplete ? '#d1d5db' : '#f59e0b';
    iconColor = isComplete ? '#94a3b8' : '#f59e0b';
  } else {
    bg = '#eff6ff'; borderColor = '#3b82f6'; iconColor = '#3b82f6';
  }

  const handleContentClick = () => {
    if (isInvoice) router.push(`/clients/${item.client_id}/invoices`);
  };

  const handleDelete = () => {
    if (onDelete && confirm('Delete this item?')) onDelete();
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 8, position: 'relative',
      padding: '7px 10px', background: bg,
      border: '1px solid #e2e8f0', borderLeft: `3px solid ${borderColor}`,
      borderRadius: 6, opacity: isComplete ? 0.5 : 1,
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
        <div onClick={isInvoice ? handleContentClick : undefined} style={{
          fontSize: 12, color: isComplete ? '#94a3b8' : '#334155', lineHeight: 1.4,
          textDecoration: isComplete ? 'line-through' : 'none',
          cursor: isInvoice ? 'pointer' : 'default',
        }}>{item.content}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
          {showClient && clientName && (
            <span onClick={() => router.push(`/clients/${item.client_id}`)} style={{
              fontSize: 10, padding: '1px 6px', borderRadius: 4,
              background: '#eff6ff', color: '#2563eb', fontWeight: 500, cursor: 'pointer',
            }}>{clientName}</span>
          )}
          <span style={{ fontSize: 10, color: '#94a3b8' }}>{relativeTime(item.created_at)}</span>
        </div>
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
