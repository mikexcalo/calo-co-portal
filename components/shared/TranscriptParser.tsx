'use client';

import { useState } from 'react';
import { useTheme } from '@/lib/theme';
import { parseTranscript, TranscriptEvent, TranscriptTask } from '@/lib/api';
import type { Event } from '@/lib/types';

type TranscriptParserProps = {
  onAddItems: (
    events: TranscriptEvent[],
    tasks: { title: string; dueDate: string | null; eventId: string | null; leadDays: number | null }[]
  ) => Promise<void>;
  existingEvents: Event[];
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtDate(d: string | null): string {
  if (!d) return 'no date';
  const dt = new Date(d + 'T00:00:00');
  return `${MONTHS[dt.getMonth()]} ${dt.getDate()}`;
}

export function TranscriptParser({ onAddItems, existingEvents }: TranscriptParserProps) {
  const { t } = useTheme();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const [suggestedEvents, setSuggestedEvents] = useState<TranscriptEvent[]>([]);
  const [suggestedTasks, setSuggestedTasks] = useState<TranscriptTask[]>([]);
  const [checkedEvents, setCheckedEvents] = useState<boolean[]>([]);
  const [checkedTasks, setCheckedTasks] = useState<boolean[]>([]);
  const [showReview, setShowReview] = useState(false);

  const handleParse = async () => {
    if (!text.trim()) return;
    setParsing(true);
    setParseError(null);
    try {
      const result = await parseTranscript(text);
      setSuggestedEvents(result.events);
      setSuggestedTasks(result.tasks);
      setCheckedEvents(result.events.map(() => true));
      setCheckedTasks(result.tasks.map(() => true));
      if (result.events.length === 0 && result.tasks.length === 0) {
        setParseError('No events or tasks found in that text. Try adding more detail.');
      } else {
        setShowReview(true);
      }
    } catch (err: any) {
      setParseError(err.message || 'Could not parse that. Try rephrasing.');
    } finally {
      setParsing(false);
    }
  };

  const handleAdd = async () => {
    setAdding(true);
    try {
      const eventsToAdd = suggestedEvents.filter((_, i) => checkedEvents[i]);
      const tasksToAdd = suggestedTasks.filter((_, i) => checkedTasks[i]);

      // Build task data — resolve anchorEventTitle to eventId after events are created
      // The parent handler will create events first, then match anchor titles
      const taskData = tasksToAdd.map((tk) => ({
        title: tk.title,
        dueDate: tk.dueDate,
        eventId: null as string | null,
        leadDays: tk.leadDays,
        anchorEventTitle: tk.anchorEventTitle,
      }));

      await onAddItems(eventsToAdd, taskData);

      // Reset
      setShowReview(false);
      setSuggestedEvents([]);
      setSuggestedTasks([]);
      setText('');
      setOpen(false);
    } catch (err: any) {
      setParseError(err.message || 'Failed to add items.');
    } finally {
      setAdding(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setShowReview(false);
    setSuggestedEvents([]);
    setSuggestedTasks([]);
    setText('');
    setParseError(null);
  };

  const totalChecked = checkedEvents.filter(Boolean).length + checkedTasks.filter(Boolean).length;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          fontSize: 12, fontWeight: 500, color: t.text.tertiary,
          background: 'none', border: `1px solid ${t.border.default}`,
          borderRadius: 6, padding: '6px 12px', cursor: 'pointer',
          fontFamily: 'inherit', transition: 'all 150ms',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = t.text.primary; e.currentTarget.style.borderColor = t.text.secondary; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = t.text.tertiary; e.currentTarget.style.borderColor = t.border.default; }}
      >
        Paste transcript
      </button>
    );
  }

  return (
    <div style={{
      background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 8,
      padding: 16, marginBottom: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: t.text.secondary }}>
          Paste transcript
        </div>
        <button
          onClick={handleClose}
          style={{ fontSize: 11, color: t.text.tertiary, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Close
        </button>
      </div>

      {!showReview ? (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste call notes, meeting transcript, or any free-form text with events and tasks..."
            rows={5}
            style={{
              width: '100%', padding: '10px 12px', fontSize: 13, border: `1px solid ${t.border.default}`,
              borderRadius: 6, fontFamily: 'inherit', background: t.bg.primary, color: t.text.primary,
              outline: 'none', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.5,
              marginBottom: 8,
            }}
            autoFocus
          />
          {parseError && (
            <div style={{ fontSize: 12, color: '#DC2626', marginBottom: 8 }}>{parseError}</div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleParse}
              disabled={!text.trim() || parsing}
              style={{
                height: 30, padding: '0 14px', fontSize: 12, fontWeight: 500,
                background: text.trim() && !parsing ? t.accent.primary : t.bg.surfaceHover,
                color: text.trim() && !parsing ? '#fff' : t.text.tertiary,
                border: 'none', borderRadius: 6, cursor: text.trim() && !parsing ? 'pointer' : 'default',
                fontFamily: 'inherit',
              }}
            >
              {parsing ? 'Parsing\u2026' : 'Parse with AI'}
            </button>
            <button
              onClick={handleClose}
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
        </>
      ) : (
        <>
          {/* Review panel */}
          {suggestedEvents.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                Events ({suggestedEvents.length})
              </div>
              {suggestedEvents.map((ev, i) => (
                <label
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0',
                    borderBottom: i < suggestedEvents.length - 1 ? `0.5px solid ${t.border.default}` : 'none',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checkedEvents[i]}
                    onChange={() => setCheckedEvents((prev) => prev.map((v, j) => j === i ? !v : v))}
                    style={{ marginTop: 2 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: t.text.primary }}>{ev.title}</div>
                    <div style={{ fontSize: 11, color: t.text.tertiary }}>
                      {fmtDate(ev.eventDate)}{ev.location ? ` \u00B7 ${ev.location}` : ''}
                    </div>
                  </div>
                </label>
              ))}
            </>
          )}

          {suggestedTasks.length > 0 && (
            <>
              <div style={{
                fontSize: 10, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase',
                letterSpacing: '0.5px', marginTop: suggestedEvents.length > 0 ? 12 : 0, marginBottom: 6,
              }}>
                Tasks ({suggestedTasks.length})
              </div>
              {suggestedTasks.map((tk, i) => (
                <label
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0',
                    borderBottom: i < suggestedTasks.length - 1 ? `0.5px solid ${t.border.default}` : 'none',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checkedTasks[i]}
                    onChange={() => setCheckedTasks((prev) => prev.map((v, j) => j === i ? !v : v))}
                    style={{ marginTop: 2 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: t.text.primary }}>{tk.title}</div>
                    <div style={{ fontSize: 11, color: t.text.tertiary }}>
                      {tk.dueDate ? `Due ${fmtDate(tk.dueDate)}` : ''}
                      {tk.anchorEventTitle ? `${tk.leadDays ?? 0}d before ${tk.anchorEventTitle}` : ''}
                      {!tk.dueDate && !tk.anchorEventTitle ? 'no date' : ''}
                    </div>
                  </div>
                </label>
              ))}
            </>
          )}

          {parseError && (
            <div style={{ fontSize: 12, color: '#DC2626', marginTop: 8 }}>{parseError}</div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              onClick={handleAdd}
              disabled={totalChecked === 0 || adding}
              style={{
                height: 30, padding: '0 14px', fontSize: 12, fontWeight: 500,
                background: totalChecked > 0 && !adding ? t.accent.primary : t.bg.surfaceHover,
                color: totalChecked > 0 && !adding ? '#fff' : t.text.tertiary,
                border: 'none', borderRadius: 6, cursor: totalChecked > 0 && !adding ? 'pointer' : 'default',
                fontFamily: 'inherit',
              }}
            >
              {adding ? 'Adding\u2026' : `Add ${totalChecked} selected`}
            </button>
            <button
              onClick={() => { setShowReview(false); setParseError(null); }}
              style={{
                height: 30, padding: '0 14px', fontSize: 12, fontWeight: 500,
                background: 'transparent', color: t.text.secondary,
                border: `1px solid ${t.border.default}`, borderRadius: 6,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Back
            </button>
          </div>
        </>
      )}
    </div>
  );
}
