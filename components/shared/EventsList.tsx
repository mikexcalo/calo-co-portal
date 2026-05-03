'use client';

import { useState } from 'react';
import { useTheme } from '@/lib/theme';
import type { Event } from '@/lib/types';

type EventsListProps = {
  events: Event[];
  taskCountsByEventId: Record<string, number>;
  onAddClick: () => void;
  onDelete: (eventId: string) => void;
};

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function friendlyDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${DAYS[d.getDay()]}, ${MONTHS_LONG[d.getMonth()]} ${d.getDate()}`;
}

const TrashIcon = ({ color }: { color: string }) => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 4h12"/><path d="M5.333 4V2.667a1.333 1.333 0 0 1 1.334-1.334h2.666a1.333 1.333 0 0 1 1.334 1.334V4"/>
    <path d="M12.667 4v9.333a1.333 1.333 0 0 1-1.334 1.334H4.667a1.333 1.333 0 0 1-1.334-1.334V4"/>
  </svg>
);

export function EventsList({ events, taskCountsByEventId, onAddClick, onDelete }: EventsListProps) {
  const { t } = useTheme();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div style={{
      background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 8,
      padding: '12px 16px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: events.length > 0 ? 4 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Events
          </span>
          <span style={{
            fontSize: 10, fontWeight: 600, color: t.text.tertiary,
            background: t.bg.surfaceHover, borderRadius: 8, padding: '1px 6px',
          }}>
            {events.length}
          </span>
        </div>
        <button
          onClick={onAddClick}
          style={{
            fontSize: 12, fontWeight: 500, color: t.text.tertiary,
            background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            padding: '2px 4px', transition: 'color 150ms',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = t.text.primary; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = t.text.tertiary; }}
        >
          + Add
        </button>
      </div>

      {/* Event rows */}
      {events.length === 0 ? (
        <div style={{ fontSize: 12, color: t.text.tertiary, padding: '4px 0' }}>
          No events yet. Click + Add to create one.
        </div>
      ) : (
        events.map((event, i) => {
          const d = new Date(event.eventDate + 'T00:00:00');
          const taskCount = taskCountsByEventId[event.id] || 0;
          const isHovered = hoveredId === event.id;

          const metaParts: string[] = [];
          if (event.location) metaParts.push(event.location);
          if (taskCount > 0) metaParts.push(`${taskCount} task${taskCount !== 1 ? 's' : ''}`);
          if (metaParts.length === 0) metaParts.push(friendlyDate(event.eventDate));

          return (
            <div
              key={event.id}
              onMouseEnter={() => setHoveredId(event.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0',
                borderTop: i > 0 ? `0.5px solid ${t.border.default}` : 'none',
              }}
            >
              {/* Date tile */}
              <div style={{
                width: 42, height: 42, borderRadius: 6, overflow: 'hidden', flexShrink: 0,
                border: `1px solid ${t.border.default}`,
              }}>
                <div style={{
                  background: '#6d28d9', height: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 8, fontWeight: 700, color: '#fff', letterSpacing: '0.5px',
                }}>
                  {MONTHS[d.getMonth()]}
                </div>
                <div style={{
                  height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, fontWeight: 700, color: t.text.primary, background: t.bg.surface,
                }}>
                  {String(d.getDate()).padStart(2, '0')}
                </div>
              </div>

              {/* Title + meta */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: t.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {event.title}
                </div>
                <div style={{ fontSize: 11, color: t.text.tertiary, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {event.location && (
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <path d="M8 1.5C5.5 1.5 3.5 3.5 3.5 6c0 3.5 4.5 8.5 4.5 8.5s4.5-5 4.5-8.5c0-2.5-2-4.5-4.5-4.5z"/>
                      <circle cx="8" cy="6" r="1.5"/>
                    </svg>
                  )}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {metaParts.join(' \u00B7 ')}
                  </span>
                </div>
              </div>

              {/* Trash */}
              <button
                onClick={() => {
                  if (confirm('Delete this event? Tasks anchored to it will keep their titles but lose their event anchor.')) onDelete(event.id);
                }}
                style={{
                  width: 20, height: 20, flexShrink: 0, cursor: 'pointer',
                  background: 'none', border: 'none', padding: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: isHovered ? 1 : 0, transition: 'opacity 150ms',
                }}
              >
                <TrashIcon color={t.text.tertiary} />
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}
