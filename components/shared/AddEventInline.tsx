'use client';

import { useState } from 'react';
import { useTheme } from '@/lib/theme';
import { parseEventFromText } from '@/lib/api';

type AddEventInlineProps = {
  onSave: (data: { title: string; eventDate: string; location?: string; description?: string }) => Promise<void>;
  onCancel: () => void;
  saving?: boolean;
};

export function AddEventInline({ onSave, onCancel, saving = false }: AddEventInlineProps) {
  const { t } = useTheme();
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');

  const [mode, setMode] = useState<'manual' | 'paste'>('manual');
  const [pasteText, setPasteText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const canSave = title.trim().length > 0 && eventDate.length > 0 && !saving;
  const canParse = pasteText.trim().length > 0 && !parsing;

  const handleSave = async () => {
    if (!canSave) return;
    await onSave({
      title: title.trim(),
      eventDate,
      location: location.trim() || undefined,
      description: description.trim() || undefined,
    });
  };

  const handleParse = async () => {
    if (!canParse) return;
    setParsing(true);
    setParseError(null);
    try {
      const parsed = await parseEventFromText(pasteText);
      setTitle(parsed.title);
      if (parsed.eventDate) setEventDate(parsed.eventDate);
      if (parsed.location) setLocation(parsed.location);
      if (parsed.description) setDescription(parsed.description);
      setMode('manual');
    } catch (err: any) {
      setParseError(err.message || 'Could not parse that. Try rephrasing.');
    } finally {
      setParsing(false);
    }
  };

  const handleCancel = () => {
    setMode('manual');
    setPasteText('');
    setParseError(null);
    onCancel();
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', fontSize: 13,
    border: `1px solid ${t.border.default}`, borderRadius: 6,
    fontFamily: 'inherit', background: t.bg.primary, color: t.text.primary,
    outline: 'none', boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 500, color: t.text.secondary, display: 'block', marginBottom: 8,
  };

  const toggleBtnStyle = (active: boolean): React.CSSProperties => ({
    fontSize: 11, fontWeight: 500, padding: '4px 10px', borderRadius: 4,
    border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 150ms',
    background: active ? t.text.primary : 'transparent',
    color: active ? t.bg.surface : t.text.tertiary,
  });

  return (
    <div style={{
      background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 8,
      padding: 16, marginTop: 8,
    }}>
      {/* Header + mode toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: t.text.secondary }}>
          New event
        </div>
        <div style={{ display: 'flex', gap: 2, background: t.bg.surfaceHover, borderRadius: 5, padding: 2 }}>
          <button onClick={() => setMode('manual')} style={toggleBtnStyle(mode === 'manual')}>Manual</button>
          <button onClick={() => setMode('paste')} style={toggleBtnStyle(mode === 'paste')}>Paste intel</button>
        </div>
      </div>

      {mode === 'paste' ? (
        /* Paste mode */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={'e.g. Stevie\'s book launch at Portland Public Library May 2 at 6pm \u2014 bring 50 books'}
            rows={3}
            style={{ ...inputStyle, marginBottom: 10, resize: 'vertical' }}
            autoFocus
          />
          {parseError && (
            <div style={{ fontSize: 12, color: '#DC2626', marginBottom: 8 }}>
              {parseError}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleParse}
              disabled={!canParse}
              style={{
                height: 30, padding: '0 14px', fontSize: 12, fontWeight: 500,
                background: canParse ? t.accent.primary : t.bg.surfaceHover,
                color: canParse ? '#fff' : t.text.tertiary,
                border: 'none', borderRadius: 6, cursor: canParse ? 'pointer' : 'default',
                fontFamily: 'inherit',
              }}
            >
              {parsing ? 'Parsing\u2026' : 'Parse with AI'}
            </button>
            <button
              onClick={handleCancel}
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
      ) : (
        /* Manual mode */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 0 }}>
            <label style={{ ...labelStyle, flex: 1 }}>
              Title <span style={{ color: '#DC2626' }}>*</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Stevie's Launch" style={{ ...inputStyle, marginTop: 3 }} autoFocus />
            </label>
            <label style={{ ...labelStyle, width: 150, flexShrink: 0 }}>
              Date <span style={{ color: '#DC2626' }}>*</span>
              <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} style={{ ...inputStyle, marginTop: 3 }} />
            </label>
          </div>

          <label style={labelStyle}>
            Location
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Portland Public Library" style={{ ...inputStyle, marginTop: 3 }} />
          </label>

          <label style={labelStyle}>
            Description
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Notes about this event..." rows={2} style={{ ...inputStyle, marginTop: 3, resize: 'vertical' }} />
          </label>

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
              {saving ? 'Saving...' : 'Save event'}
            </button>
            <button
              onClick={handleCancel}
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
      )}
    </div>
  );
}
