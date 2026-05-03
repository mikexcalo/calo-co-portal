'use client';

import { useState } from 'react';
import { useTheme } from '@/lib/theme';
import type { Event } from '@/lib/types';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type AddTaskInlineProps = {
  events: Event[];
  onSave: (data: { title: string; dueDate: string | null; eventId: string | null; leadDays: number | null }) => Promise<void>;
  onCancel: () => void;
  saving?: boolean;
};

export function AddTaskInline({ events, onSave, onCancel, saving = false }: AddTaskInlineProps) {
  const { t } = useTheme();
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [eventId, setEventId] = useState('');
  const [leadDays, setLeadDays] = useState('');

  const hasEvent = eventId.length > 0;
  const canSave = title.trim().length > 0 && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    await onSave({
      title: title.trim(),
      dueDate: hasEvent ? null : (dueDate || null),
      eventId: hasEvent ? eventId : null,
      leadDays: hasEvent && leadDays ? parseInt(leadDays, 10) : null,
    });
  };

  const inputStyle: React.CSSProperties = {
    padding: '8px 10px', fontSize: 13,
    border: `1px solid ${t.border.default}`, borderRadius: 6,
    fontFamily: 'inherit', background: t.bg.primary, color: t.text.primary,
    outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{
      background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 8,
      padding: 16, marginTop: 8,
    }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs to happen?"
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
          style={{ ...inputStyle, flex: 1 }}
          autoFocus
        />
        {!hasEvent && (
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            style={{ ...inputStyle, width: 140 }}
          />
        )}
      </div>

      {events.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <select
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            style={{ ...inputStyle, flex: 1, appearance: 'none' as const, backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 12 12%27%3E%3Cpath d=%27M3 5l3 3 3-3%27 fill=%27none%27 stroke=%27%236b7280%27 stroke-width=%271.5%27/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', paddingRight: 28 }}
          >
            <option value="">Anchor to event (optional)</option>
            {events.map((ev) => {
              const d = new Date(ev.eventDate + 'T00:00:00');
              return (
                <option key={ev.id} value={ev.id}>
                  {ev.title} ({MONTHS_SHORT[d.getMonth()]} {d.getDate()})
                </option>
              );
            })}
          </select>
          {hasEvent && (
            <input
              type="number"
              min="0"
              value={leadDays}
              onChange={(e) => setLeadDays(e.target.value)}
              placeholder="Lead days"
              style={{ ...inputStyle, width: 100 }}
            />
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleSave}
          disabled={!canSave}
          style={{
            height: 30, padding: '0 14px', fontSize: 12, fontWeight: 500,
            background: canSave ? t.accent.primary : t.bg.surfaceHover,
            color: canSave ? '#fff' : t.text.tertiary,
            border: 'none', borderRadius: 6, cursor: canSave ? 'pointer' : 'default',
            fontFamily: 'inherit',
          }}
        >
          {saving ? 'Saving...' : 'Save task'}
        </button>
        <button
          onClick={onCancel}
          style={{
            height: 30, padding: '0 14px', fontSize: 12, fontWeight: 500,
            background: 'transparent', color: t.text.secondary,
            border: `1px solid ${t.border.default}`, borderRadius: 6,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
