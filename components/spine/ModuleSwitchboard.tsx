'use client';

/**
 * One switchboard, used twice: for a client, and for yourself.
 *
 * Access answered "what can this client open". The same question exists about
 * your own workspace and had no screen at all, so everything the product can
 * do was permanently on and the sidebar carried rows for work nobody is doing
 * yet. Turning something off for yourself is the same operation as turning it
 * off for somebody else, so it is the same component.
 *
 * GROUPED THE WAY THE SIDEBAR IS
 *
 * It listed everything in one column, which meant reading it required holding
 * the sidebar's grouping in your head and mapping each row onto it. Same
 * headings, same order. A switchboard should be laid out like the thing it
 * controls.
 *
 * Features are last and separate, because they are not places. A module puts a
 * row in a sidebar; a feature changes what a screen you already have can do.
 * Switching Catalog on and then hunting the nav for it finds nothing, which is
 * only confusing while the two look like the same kind of switch.
 */

import { useMemo } from 'react';
import {
  MODULE_ICON,
  MODULE_KIND,
  MODULE_LABEL,
  MODULE_SECTION,
  NAV_SECTIONS,
  moduleState,
  type ModuleId,
  type ModuleState,
} from '@/lib/spine/modules';
import { NAV_ICONS } from '@/components/Sidebar';
import { C, Card, Switch } from './ui';

export function ModuleSwitchboard({
  modules,
  state,
  what,
  onChange,
  onSell,
  showSold = false,
}: {
  modules: ModuleId[];
  state: Record<string, unknown>;
  /** One line saying what each module is, so a switch is never a guess. */
  what: Partial<Record<ModuleId, string>>;
  onChange: (id: ModuleId, next: ModuleState) => void;
  /** Only a client can be sold something. Absent when this is your own list. */
  onSell?: (id: ModuleId, selling: boolean) => void;
  showSold?: boolean;
}) {
  const groups = useMemo(() => {
    const out: Array<{ heading: string; note: string; items: ModuleId[] }> = [];
    for (const section of NAV_SECTIONS) {
      const items = modules.filter(
        (m) => (MODULE_KIND[m] ?? 'place') === 'place' && MODULE_SECTION[m] === section
      );
      if (items.length) out.push({ heading: section, note: 'a row in the sidebar', items });
    }
    const features = modules.filter((m) => (MODULE_KIND[m] ?? 'place') === 'capability');
    if (features.length) {
      out.push({
        heading: 'Features',
        note: 'changes a screen you already have, and adds no row',
        items: features,
      });
    }
    return out;
  }, [modules]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {groups.map((g) => (
        <div key={g.heading}>
          <div
            style={{
              display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 7,
              fontFamily: 'var(--font-display), var(--font-sans), system-ui, sans-serif',
            }}
          >
            <span
              style={{
                fontSize: 10.5, fontWeight: 600, letterSpacing: '.09em',
                textTransform: 'uppercase', color: C.faint,
              }}
            >
              {g.heading}
            </span>
            <span style={{ fontSize: 11.5, color: C.faint, fontVariantNumeric: 'tabular-nums' }}>
              {g.items.length}
            </span>
            <span style={{ fontSize: 11.5, color: C.faint }}>· {g.note}</span>
          </div>

          <Card>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {g.items.map((m, i) => {
                const st = moduleState(state[m]);
                const live = st === 'live';
                const selling = st === 'sold' || st === 'building';
                return (
                  <div
                    key={m}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 11,
                      padding: '9px 0', flexWrap: 'wrap',
                      borderTop: i === 0 ? 'none' : `1px solid ${C.border}`,
                    }}
                  >
                    <span style={{ color: C.faint, flexShrink: 0, display: 'flex' }}>
                      {NAV_ICONS[MODULE_ICON[m]] ?? null}
                    </span>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 14, color: C.text }}>{MODULE_LABEL[m]}</div>
                      <div style={{ fontSize: 12.5, color: C.faint }}>{what[m] ?? ''}</div>
                    </div>

                    {showSold && onSell && !live && (
                      <button
                        onClick={() => onSell(m, selling)}
                        style={{
                          fontSize: 11.5, padding: '2px 10px', borderRadius: 999,
                          cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
                          border: `1px solid ${selling ? C.amber : C.border}`,
                          background: selling ? C.amberSoft : 'transparent',
                          color: selling ? C.amber : C.faint,
                        }}
                      >
                        {selling ? 'sold, not built' : 'mark sold'}
                      </button>
                    )}

                    <Switch on={live} onChange={(next) => onChange(m, next ? 'live' : 'off')} />
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      ))}
    </div>
  );
}
