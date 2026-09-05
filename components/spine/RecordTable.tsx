'use client';

/**
 * One list, drawn once.
 *
 * Three screens showed two nouns in three visual languages: Pipeline was a 34px
 * table, Clients was the same table filtered differently but drawn as 120px
 * cards with 17px bold names, and People was an accordion that expanded into a
 * form grid. Learning to scan one taught you nothing about the next.
 *
 * The card layout also asserted something untrue. Giving a client seven times
 * the vertical space of a prospect says a client matters more, which stops
 * being true the moment a prospect is worth more than a client, and it is the
 * reason a hundred and four companies were unreadable.
 *
 * WHY SELECTION IS BUILT IN RATHER THAN ADDED PER SCREEN
 *
 * There was no checkbox anywhere in the product. Tagging ten companies meant
 * ten page loads, and a hundred and four rows arrived by import with no way to
 * work them. Selection belongs to the table because every list needs it and
 * because three separate implementations is how three lists drifted apart in
 * the first place.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { C } from './ui';

export interface Column<T> {
  key: string;
  label: string;
  /** CSS grid track. Fixed widths for data, fractions for text. */
  width: string;
  render: (row: T) => React.ReactNode;
  /** How to order by this column. Absent means it cannot be sorted. */
  sortBy?: (row: T) => string | number;
  align?: 'right';
}

export function RecordTable<T extends { id: string }>({
  rows,
  columns,
  onOpen,
  selected,
  onSelect,
  empty = 'Nothing here.',
}: {
  rows: T[];
  columns: Column<T>[];
  onOpen: (row: T) => void;
  /** Omit both to render a table nobody can select in. */
  selected?: Set<string>;
  onSelect?: (next: Set<string>) => void;
  empty?: string;
}) {
  const [sort, setSort] = useState<{ key: string; desc: boolean } | null>(null);
  /** For shift-click ranges, which is the only reason anyone tolerates checkboxes. */
  const lastClicked = useRef<string | null>(null);
  const selectable = Boolean(selected && onSelect);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortBy) return rows;
    const by = col.sortBy;
    return [...rows].sort((a, b) => {
      const x = by(a);
      const y = by(b);
      const n = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
      return sort.desc ? -n : n;
    });
  }, [rows, sort, columns]);

  const allOn = selectable && sorted.length > 0 && sorted.every((r) => selected!.has(r.id));

  const toggleAll = () => {
    if (!onSelect) return;
    onSelect(allOn ? new Set() : new Set(sorted.map((r) => r.id)));
  };

  const toggle = useCallback(
    (id: string, shift: boolean) => {
      if (!selected || !onSelect) return;
      const next = new Set(selected);
      if (shift && lastClicked.current) {
        // A range, from the last one touched to this one, in the order shown
        // rather than the order stored. Anything else surprises people.
        const ids = sorted.map((r) => r.id);
        const a = ids.indexOf(lastClicked.current);
        const b = ids.indexOf(id);
        if (a >= 0 && b >= 0) {
          const [lo, hi] = a < b ? [a, b] : [b, a];
          for (let i = lo; i <= hi; i++) next.add(ids[i]);
          onSelect(next);
          return;
        }
      }
      if (next.has(id)) next.delete(id);
      else next.add(id);
      lastClicked.current = id;
      onSelect(next);
    },
    [selected, onSelect, sorted]
  );

  // Escape clears a selection. Somebody who has selected forty rows by accident
  // should not have to find the clear button.
  useEffect(() => {
    if (!selectable) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selected!.size) onSelect!(new Set());
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [selectable, selected, onSelect]);

  const grid = `${selectable ? '30px ' : ''}${columns.map((c) => c.width).join(' ')}`;

  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 640 }}>
          <div
            style={{
              display: 'grid', gridTemplateColumns: grid, gap: 12,
              padding: '7px 14px', background: C.panelAlt,
              borderBottom: `1px solid ${C.border}`,
              fontSize: 10.5, letterSpacing: '.05em', textTransform: 'uppercase', color: C.faint,
              alignItems: 'center',
            }}
          >
            {selectable && (
              <input
                type="checkbox"
                checked={allOn}
                onChange={toggleAll}
                aria-label="Select all"
                style={{ cursor: 'pointer', margin: 0 }}
              />
            )}
            {columns.map((c) => (
              <button
                key={c.key}
                onClick={() =>
                  c.sortBy &&
                  setSort((s) => (s?.key === c.key ? { key: c.key, desc: !s.desc } : { key: c.key, desc: false }))
                }
                disabled={!c.sortBy}
                style={{
                  background: 'transparent', border: 'none', padding: 0,
                  font: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit',
                  color: sort?.key === c.key ? C.dim : C.faint,
                  cursor: c.sortBy ? 'pointer' : 'default',
                  textAlign: c.align === 'right' ? 'right' : 'left',
                  whiteSpace: 'nowrap',
                }}
              >
                {c.label}
                {sort?.key === c.key && (sort.desc ? ' ↓' : ' ↑')}
              </button>
            ))}
          </div>

          {sorted.length === 0 ? (
            <div style={{ padding: '22px 14px', fontSize: 13.5, color: C.faint, background: C.panel }}>
              {empty}
            </div>
          ) : (
            sorted.map((row, i) => {
              const on = selectable && selected!.has(row.id);
              return (
                <div
                  key={row.id}
                  onClick={() => onOpen(row)}
                  style={{
                    display: 'grid', gridTemplateColumns: grid, gap: 12,
                    padding: '8px 14px', alignItems: 'center', cursor: 'pointer',
                    borderTop: i === 0 ? 'none' : `1px solid ${C.border}`,
                    background: on ? C.accentSoft : C.panel,
                  }}
                >
                  {selectable && (
                    <input
                      type="checkbox"
                      checked={on}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => toggle(row.id, (e.nativeEvent as MouseEvent).shiftKey)}
                      aria-label={`Select row ${i + 1}`}
                      style={{ cursor: 'pointer', margin: 0 }}
                    />
                  )}
                  {columns.map((c) => (
                    <div
                      key={c.key}
                      style={{
                        minWidth: 0,
                        textAlign: c.align === 'right' ? 'right' : undefined,
                      }}
                    >
                      {c.render(row)}
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The bar that appears when something is selected.
 *
 * Fixed to the bottom rather than pushed into the header, because a selection
 * made forty rows down should not require scrolling back up to act on it, and
 * because it has to be obvious that a mode has been entered.
 */
export function BulkBar({
  count,
  onClear,
  children,
}: {
  count: number;
  onClear: () => void;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div
      style={{
        position: 'fixed', left: '50%', bottom: 22, transform: 'translateX(-50%)',
        zIndex: 60, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
        background: C.text, color: C.panel,
        borderRadius: 999, padding: '8px 10px 8px 18px',
        boxShadow: '0 6px 24px rgba(0,0,0,.22)',
        maxWidth: 'calc(100vw - 32px)',
      }}
    >
      <span style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        {count} selected
      </span>
      {children}
      <button
        onClick={onClear}
        style={{
          background: 'transparent', border: 'none', padding: '0 6px',
          color: C.panel, opacity: 0.65, fontSize: 13,
          cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        Clear
      </button>
    </div>
  );
}

/** A button inside the bulk bar. Reads on the dark pill, unlike the app's own. */
export function BulkAction({
  children,
  onClick,
  tone = 'normal',
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: 'normal' | 'danger';
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'transparent',
        border: `1px solid ${tone === 'danger' ? '#ff8f86' : 'rgba(255,255,255,.28)'}`,
        color: tone === 'danger' ? '#ff8f86' : C.panel,
        borderRadius: 999, padding: '4px 13px', fontSize: 12.5,
        cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}
