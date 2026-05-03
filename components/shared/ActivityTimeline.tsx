'use client';

import { useState } from 'react';
import { useTheme } from '@/lib/theme';
import type { Note } from '@/lib/types';

type ActivityTimelineProps = {
  notes: Note[];
  onDelete?: (noteId: string) => void;
};

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const d = new Date(iso);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const thisYear = new Date().getFullYear();
  if (d.getFullYear() !== thisYear) {
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

const kindLabel: Record<string, string> = {
  note: 'Note',
  call: 'Call',
  meeting: 'Meeting',
  email: 'Email',
  transcript: 'Transcript',
  other: 'Other',
};

export function ActivityTimeline({ notes, onDelete }: ActivityTimelineProps) {
  const { t } = useTheme();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (notes.length === 0) {
    return (
      <div style={{ padding: '24px 0', fontSize: 13, color: t.text.tertiary }}>
        No activity yet. Add your first note above.
      </div>
    );
  }

  return (
    <div>
      {notes.map((note, i) => (
        <div
          key={note.id}
          onMouseEnter={() => setHoveredId(note.id)}
          onMouseLeave={() => setHoveredId(null)}
          style={{
            display: 'flex', gap: 12, padding: '16px 0',
            borderBottom: i < notes.length - 1 ? `0.5px solid ${t.border.default}` : 'none',
          }}
        >
          {/* Icon badge */}
          <div style={{
            width: 28, height: 28, borderRadius: 14, flexShrink: 0,
            background: 'rgba(245, 158, 11, 0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1,
          }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#F59E0B" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 1.5h8a1 1 0 0 1 1 1v12l-5-2.5L3 14.5v-12a1 1 0 0 1 1-1z"/>
              <line x1="6" y1="5.5" x2="10" y2="5.5"/>
              <line x1="6" y1="8" x2="9" y2="8"/>
            </svg>
          </div>

          {/* Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 12, color: t.text.tertiary, marginBottom: 4 }}>
                You &middot; {relativeTime(note.createdAt)} &middot; {kindLabel[note.kind] || 'Note'}
              </div>
              {onDelete && (
                <button
                  onClick={() => {
                    if (confirm('Delete this note?')) onDelete(note.id);
                  }}
                  style={{
                    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 20, height: 20, flexShrink: 0,
                    opacity: hoveredId === note.id ? 1 : 0, transition: 'opacity 150ms',
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke={t.text.tertiary} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 4h12"/><path d="M5.333 4V2.667a1.333 1.333 0 0 1 1.334-1.334h2.666a1.333 1.333 0 0 1 1.334 1.334V4"/>
                    <path d="M12.667 4v9.333a1.333 1.333 0 0 1-1.334 1.334H4.667a1.333 1.333 0 0 1-1.334-1.334V4"/>
                  </svg>
                </button>
              )}
            </div>
            <div style={{
              fontSize: 14, color: t.text.primary, lineHeight: 1.5,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {note.content}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
