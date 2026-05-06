'use client';

import { useState } from 'react';
import { useTheme } from '@/lib/theme';
import { parseContactsFromNotes, type ParsedContact } from '@/lib/api';
import { StatusPill } from '@/components/shared/StatusPill';

const KIND_OPTIONS = [
  { value: 'lead', label: 'Lead' },
  { value: 'prospect', label: 'Prospect' },
  { value: 'client_contact', label: 'Client contact' },
  { value: 'talent', label: 'Talent' },
  { value: 'vendor', label: 'Vendor' },
  { value: 'friend', label: 'Friend' },
] as const;

const avatarBgs = ['#e8d5b7', '#c4d4c8', '#d4c4d8', '#c4cdd8', '#d8c4c4'];
const avatarFgs = ['#6b4a1a', '#2d4a3a', '#4a2d4a', '#2d3a4a', '#4a2d2d'];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.[0] || '?').toUpperCase();
}

type DropNotesPanelProps = {
  onAdd: (contacts: ParsedContact[]) => Promise<void>;
};

export function DropNotesPanel({ onAdd }: DropNotesPanelProps) {
  const { t } = useTheme();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const [suggestions, setSuggestions] = useState<ParsedContact[]>([]);
  const [checked, setChecked] = useState<boolean[]>([]);
  const [showReview, setShowReview] = useState(false);

  const handleParse = async () => {
    if (!text.trim()) return;
    setParsing(true);
    setParseError(null);
    try {
      const result = await parseContactsFromNotes(text);
      if (result.contacts.length === 0) {
        setParseError('No contacts found in that text. Try adding more detail about the people you met.');
      } else {
        setSuggestions(result.contacts);
        setChecked(result.contacts.map(() => true));
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
      const toAdd = suggestions.filter((_, i) => checked[i]);
      await onAdd(toAdd);
      handleClose();
    } catch (err: any) {
      setParseError(err.message || 'Failed to add contacts.');
    } finally {
      setAdding(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setShowReview(false);
    setSuggestions([]);
    setChecked([]);
    setText('');
    setParseError(null);
  };

  const updateSuggestion = (idx: number, patch: Partial<ParsedContact>) => {
    setSuggestions((prev) => prev.map((s, i) => i === idx ? { ...s, ...patch } : s));
  };

  const totalChecked = checked.filter(Boolean).length;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          height: 36, padding: '0 14px', fontSize: 13, fontWeight: 500,
          background: t.bg.surface, color: t.text.secondary,
          border: `1px solid ${t.border.default}`, borderRadius: 8,
          cursor: 'pointer', fontFamily: 'inherit', transition: 'all 150ms',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.text.secondary; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border.default; }}
      >
        Drop notes
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
          Drop notes
        </div>
        <button onClick={handleClose} style={{ fontSize: 11, color: t.text.tertiary, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
          Close
        </button>
      </div>

      {!showReview ? (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'Met Jordan at Empire State event, runs a photo studio in Brooklyn. Sam Ricci — manufacturing, wants new branding. Avi from the photo coop, interested in collab...'}
            rows={5}
            style={{
              width: '100%', padding: '10px 12px', fontSize: 13, border: `1px solid ${t.border.default}`,
              borderRadius: 6, fontFamily: 'inherit', background: t.bg.primary, color: t.text.primary,
              outline: 'none', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.5,
              marginBottom: 8,
            }}
            autoFocus
          />
          {parseError && <div style={{ fontSize: 12, color: '#DC2626', marginBottom: 8 }}>{parseError}</div>}
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
            <button onClick={handleClose} style={{
              height: 30, padding: '0 14px', fontSize: 12, fontWeight: 500,
              background: 'transparent', color: t.text.secondary,
              border: `1px solid ${t.border.default}`, borderRadius: 6,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 10, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
            {suggestions.length} contact{suggestions.length !== 1 ? 's' : ''} found
          </div>

          {suggestions.map((contact, i) => {
            const avatarIdx = (contact.name.charCodeAt(0) || 0) % 5;
            return (
              <div
                key={i}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0',
                  borderBottom: i < suggestions.length - 1 ? `0.5px solid ${t.border.default}` : 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked[i]}
                  onChange={() => setChecked((prev) => prev.map((v, j) => j === i ? !v : v))}
                  style={{ marginTop: 4 }}
                />
                <div style={{
                  width: 28, height: 28, borderRadius: 14, flexShrink: 0,
                  background: avatarBgs[avatarIdx], color: avatarFgs[avatarIdx],
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, marginTop: 1,
                }}>
                  {getInitials(contact.name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <input
                      value={contact.name}
                      onChange={(e) => updateSuggestion(i, { name: e.target.value })}
                      style={{
                        fontSize: 13, fontWeight: 500, color: t.text.primary,
                        background: 'transparent', border: 'none', outline: 'none',
                        fontFamily: 'inherit', padding: 0, width: 'auto', minWidth: 60,
                      }}
                    />
                    <select
                      value={contact.kind}
                      onChange={(e) => updateSuggestion(i, { kind: e.target.value as ParsedContact['kind'] })}
                      style={{
                        fontSize: 10, fontWeight: 500, padding: '2px 18px 2px 6px',
                        borderRadius: 8, border: 'none', cursor: 'pointer',
                        fontFamily: 'inherit', outline: 'none',
                        background: 'rgba(59, 130, 246, 0.08)', color: '#1E3A5F',
                        appearance: 'none' as const,
                        backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%278%27 height=%278%27 viewBox=%270 0 8 8%27%3E%3Cpath d=%27M2 3l2 2 2-2%27 fill=%27none%27 stroke=%27%236b7280%27 stroke-width=%271%27/%3E%3C/svg%3E")',
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 4px center',
                      }}
                    >
                      {KIND_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  {contact.role && (
                    <input
                      value={contact.role}
                      onChange={(e) => updateSuggestion(i, { role: e.target.value })}
                      style={{
                        fontSize: 11, color: t.text.tertiary, background: 'transparent',
                        border: 'none', outline: 'none', fontFamily: 'inherit', padding: 0,
                        width: '100%', marginBottom: 2,
                      }}
                    />
                  )}
                  {contact.note && (
                    <div style={{ fontSize: 11, color: t.text.tertiary, fontStyle: 'italic' }}>
                      {contact.note}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {parseError && <div style={{ fontSize: 12, color: '#DC2626', marginTop: 8 }}>{parseError}</div>}

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
              {adding ? 'Adding\u2026' : `Add ${totalChecked} contact${totalChecked !== 1 ? 's' : ''}`}
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
