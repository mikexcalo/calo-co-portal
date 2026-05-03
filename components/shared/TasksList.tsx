'use client';

import { useState } from 'react';
import { useTheme } from '@/lib/theme';
import type { Task, Event } from '@/lib/types';

type TasksListProps = {
  tasks: Task[];
  events: Event[];
  onAddClick: () => void;
  onToggleComplete: (taskId: string, completed: boolean) => void;
  onDelete: (taskId: string) => void;
};

function getEffectiveDueDate(task: Task, events: Event[]): string | null {
  if (task.dueDate) return task.dueDate;
  if (task.eventId) {
    const event = events.find(e => e.id === task.eventId);
    if (!event) return null;
    if (task.leadDays != null) {
      const d = new Date(event.eventDate + 'T00:00:00');
      d.setDate(d.getDate() - task.leadDays);
      return d.toISOString().split('T')[0];
    }
    return event.eventDate;
  }
  return null;
}

function formatDueDate(dueDate: string | null, isCompleted: boolean): { text: string; color: string } | null {
  if (!dueDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + 'T00:00:00');
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);

  if (isCompleted) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return { text: `${months[due.getMonth()]} ${due.getDate()}`, color: '' };
  }

  if (diffDays < 0) return { text: `${Math.abs(diffDays)}d overdue`, color: '#DC2626' };
  if (diffDays === 0) return { text: 'today', color: '#F59E0B' };
  if (diffDays === 1) return { text: 'tomorrow', color: '' };
  if (diffDays <= 7) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return { text: `${days[due.getDay()]} ${months[due.getMonth()]} ${due.getDate()}`, color: '' };
  }
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return { text: `${months[due.getMonth()]} ${due.getDate()}`, color: '' };
}

const TrashIcon = ({ color }: { color: string }) => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 4h12"/><path d="M5.333 4V2.667a1.333 1.333 0 0 1 1.334-1.334h2.666a1.333 1.333 0 0 1 1.334 1.334V4"/>
    <path d="M12.667 4v9.333a1.333 1.333 0 0 1-1.334 1.334H4.667a1.333 1.333 0 0 1-1.334-1.334V4"/>
  </svg>
);

export function TasksList({ tasks, events, onAddClick, onToggleComplete, onDelete }: TasksListProps) {
  const { t } = useTheme();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const openCount = tasks.filter((tk) => !tk.completedAt).length;

  return (
    <div style={{
      background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 8,
      padding: '12px 16px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: tasks.length > 0 ? 4 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Next actions
          </span>
          <span style={{
            fontSize: 10, fontWeight: 600, color: t.text.tertiary,
            background: t.bg.surfaceHover, borderRadius: 8, padding: '1px 6px',
          }}>
            {openCount}
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

      {/* Task rows */}
      {tasks.length === 0 ? (
        <div style={{ fontSize: 12, color: t.text.tertiary, padding: '4px 0' }}>
          No tasks yet. Click + Add to create one.
        </div>
      ) : (
        tasks.map((task, i) => {
          const isComplete = !!task.completedAt;
          const effectiveDue = getEffectiveDueDate(task, events);
          const dueFmt = formatDueDate(effectiveDue, isComplete);
          const isHovered = hoveredId === task.id;
          const anchoredEvent = task.eventId ? events.find(e => e.id === task.eventId) : null;

          return (
            <div
              key={task.id}
              onMouseEnter={() => setHoveredId(task.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
                borderTop: i > 0 ? `0.5px solid ${t.border.default}` : 'none',
              }}
            >
              {/* Checkbox */}
              <button
                onClick={() => onToggleComplete(task.id, !isComplete)}
                style={{
                  width: 16, height: 16, borderRadius: 3, flexShrink: 0, cursor: 'pointer',
                  border: isComplete ? 'none' : `1.5px solid ${t.border.default}`,
                  background: isComplete ? t.accent.primary : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                }}
              >
                {isComplete && (
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="2.5 6 5 8.5 9.5 3.5"/>
                  </svg>
                )}
              </button>

              {/* Title */}
              <div style={{
                flex: 1, minWidth: 0, fontSize: 13,
                color: isComplete ? t.text.tertiary : t.text.primary,
                textDecoration: isComplete ? 'line-through' : 'none',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {task.title}
              </div>

              {/* Event chip */}
              {anchoredEvent && (
                <span style={{
                  fontSize: 10, fontWeight: 500, flexShrink: 0,
                  color: '#6d28d9', background: 'rgba(109, 40, 217, 0.08)',
                  borderRadius: 3, padding: '1px 6px',
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <rect x="2" y="3" width="12" height="11" rx="1.5"/><line x1="2" y1="7" x2="14" y2="7"/><line x1="5.5" y1="1.5" x2="5.5" y2="4.5"/><line x1="10.5" y1="1.5" x2="10.5" y2="4.5"/>
                  </svg>
                  {anchoredEvent.title.length > 20 ? anchoredEvent.title.slice(0, 20) + '...' : anchoredEvent.title}
                </span>
              )}

              {/* Due date */}
              {dueFmt && (
                <span style={{
                  fontSize: 11, flexShrink: 0,
                  color: dueFmt.color || (isComplete ? t.text.tertiary : t.text.secondary),
                  opacity: isComplete ? 0.5 : 1,
                  fontWeight: dueFmt.color ? 500 : 400,
                }}>
                  {dueFmt.text}
                </span>
              )}

              {/* Trash */}
              <button
                onClick={() => {
                  if (confirm('Delete this task?')) onDelete(task.id);
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
