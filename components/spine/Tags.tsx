'use client';

/**
 * Tags, instead of a field builder.
 *
 * The list of companies carried segment, region and size as three columns,
 * which asks three questions of every company whether or not they apply and
 * cannot ask a fourth at all. The usual answer is custom fields, and custom
 * fields are the thing that turns a CRM into a project: field types, per
 * workspace schemas, a settings screen nobody finishes.
 *
 * One array of words does almost all of it. Northeast, independent, shrimp,
 * met at a show. It takes anything, it costs nothing to leave empty, and it is
 * the shape a person reaches for when they are trying to remember who somebody
 * was.
 *
 * WHY EXISTING TAGS ARE OFFERED
 *
 * Free text splits: Northeast, northeast, North East, and now the filter finds
 * a third of them. Suggesting what is already in use costs one query and keeps
 * the vocabulary converging without ever forbidding a new word.
 */

import { useMemo, useState } from 'react';
import { C } from './ui';

export function Tags({
  tags,
  known = [],
  onChange,
  editable = true,
}: {
  tags: string[];
  /** Every tag already used in this workspace, for suggestions. */
  known?: string[];
  onChange?: (next: string[]) => void;
  editable?: boolean;
}) {
  const [typing, setTyping] = useState('');
  const [open, setOpen] = useState(false);

  const suggestions = useMemo(() => {
    const t = typing.trim().toLowerCase();
    const have = new Set(tags.map((x) => x.toLowerCase()));
    return known
      .filter((k) => !have.has(k.toLowerCase()) && (!t || k.toLowerCase().includes(t)))
      .slice(0, 8);
  }, [known, tags, typing]);

  const add = (raw: string) => {
    const word = raw.trim();
    if (!word) return;
    if (tags.some((t) => t.toLowerCase() === word.toLowerCase())) { setTyping(''); return; }
    onChange?.([...tags, word]);
    setTyping('');
  };

  const drop = (word: string) => onChange?.(tags.filter((t) => t !== word));

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      {tags.map((t) => (
        <span
          key={t}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 12, color: C.dim,
            border: `1px solid ${C.border}`, background: C.panelAlt,
            borderRadius: 6, padding: '3px 8px',
          }}
        >
          {t}
          {editable && onChange && (
            <button
              onClick={() => drop(t)}
              aria-label={`Remove ${t}`}
              style={{
                background: 'transparent', border: 'none', padding: 0,
                color: C.faint, cursor: 'pointer', fontSize: 13, lineHeight: 1,
                fontFamily: 'inherit',
              }}
            >
              ×
            </button>
          )}
        </span>
      ))}

      {editable && onChange && (
        <span style={{ position: 'relative' }}>
          <input
            value={typing}
            onChange={(e) => { setTyping(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(typing); }
              if (e.key === 'Backspace' && !typing && tags.length) drop(tags[tags.length - 1]);
            }}
            placeholder={tags.length ? 'add' : 'add a tag'}
            style={{
              border: `1px dashed ${C.border}`, background: 'transparent',
              borderRadius: 6, padding: '3px 8px', fontSize: 12,
              color: C.text, fontFamily: 'inherit', width: tags.length ? 62 : 92,
              outline: 'none',
            }}
          />

          {open && suggestions.length > 0 && (
            <div
              style={{
                position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 20,
                background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8,
                boxShadow: '0 4px 14px rgba(0,0,0,.10)', padding: 4, minWidth: 170,
                maxHeight: 210, overflowY: 'auto',
              }}
            >
              {suggestions.map((s) => (
                <button
                  key={s}
                  onMouseDown={(e) => { e.preventDefault(); add(s); }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    padding: '6px 8px', borderRadius: 6,
                    fontSize: 12.5, color: C.dim, fontFamily: 'inherit',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </span>
      )}
    </div>
  );
}
