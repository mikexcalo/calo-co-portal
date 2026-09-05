'use client';

/**
 * A filter set, given a name.
 *
 * Filters lived in component state and reset the moment you navigated away, so
 * "Northeast independents I have not called in a month" had to be rebuilt every
 * single morning. Rebuilding that view is not preparation for the work; for
 * anybody doing outbound it IS the work, and charging for it in clicks daily
 * was the largest tax this product levied.
 *
 * WHY IT IS NOT A QUERY BUILDER
 *
 * Every CRM that grows one ends up with a modal of AND/OR rows that people use
 * once. This saves the state the screen already holds, so making a view costs
 * nothing a person was not already doing: filter the list, press save, name it.
 * Anything the screen cannot filter by, a view cannot hold, which is a limit
 * worth having because it keeps the two in step.
 */

import { useCallback, useEffect, useState } from 'react';
import supabase from '@/lib/supabase';
import { C } from './ui';

export interface View {
  id: string;
  name: string;
  filters: Record<string, unknown>;
}

export function SavedViews({
  screen,
  orgId,
  current,
  active,
  onApply,
}: {
  screen: 'pipeline' | 'clients' | 'people';
  orgId: string | null;
  /** What the screen is filtered by right now. */
  current: Record<string, unknown>;
  /** Which saved view is applied, if any. */
  active: string | null;
  onApply: (view: View | null) => void;
}) {
  const [views, setViews] = useState<View[]>([]);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');

  const load = useCallback(async () => {
    const res = await supabase
      .from('saved_views')
      .select('id, name, filters')
      .eq('screen', screen)
      .order('sort')
      .order('created_at');
    if (!res.error) setViews((res.data ?? []) as View[]);
  }, [screen]);

  useEffect(() => { load(); }, [load]);

  /**
   * Is anything actually filtered?
   *
   * Saving an unfiltered list produces a view identical to the screen's default
   * and teaches people the feature does nothing, so the button only appears
   * when there is something to keep.
   */
  const worthSaving = Object.values(current).some(
    (v) => v !== null && v !== undefined && v !== '' && v !== 'all'
  );

  const save = async () => {
    if (!orgId || !name.trim()) return;
    const res = await supabase
      .from('saved_views')
      .insert({ org_id: orgId, screen, name: name.trim(), filters: current, sort: views.length })
      .select('id, name, filters')
      .maybeSingle();
    if (!res.error && res.data) {
      setViews((v) => [...v, res.data as View]);
      onApply(res.data as View);
    }
    setName('');
    setNaming(false);
  };

  const remove = async (id: string) => {
    setViews((v) => v.filter((x) => x.id !== id));
    if (active === id) onApply(null);
    await supabase.from('saved_views').delete().eq('id', id);
  };

  if (views.length === 0 && !worthSaving) return null;

  const chip = (label: string, on: boolean, onClick: () => void, onX?: () => void) => (
    <span
      key={label}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        border: `1px solid ${on ? C.accent : C.border}`,
        background: on ? C.accentSoft : 'transparent',
        color: on ? C.text : C.faint,
        borderRadius: 999, padding: '3px 11px', fontSize: 12.5,
        whiteSpace: 'nowrap',
      }}
    >
      <button
        onClick={onClick}
        style={{
          background: 'transparent', border: 'none', padding: 0,
          color: 'inherit', font: 'inherit', cursor: 'pointer',
        }}
      >
        {label}
      </button>
      {onX && on && (
        <button
          onClick={onX}
          aria-label={`Delete view ${label}`}
          style={{
            background: 'transparent', border: 'none', padding: 0,
            color: C.faint, cursor: 'pointer', fontSize: 13, lineHeight: 1, fontFamily: 'inherit',
          }}
        >
          ×
        </button>
      )}
    </span>
  );

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
      {views.length > 0 && (
        <span style={{ fontSize: 11.5, color: C.faint, letterSpacing: '.04em', textTransform: 'uppercase' }}>
          Views
        </span>
      )}

      {views.map((v) => chip(v.name, active === v.id, () => onApply(active === v.id ? null : v), () => remove(v.id)))}

      {naming ? (
        <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save();
              if (e.key === 'Escape') { setNaming(false); setName(''); }
            }}
            placeholder="Name this view"
            autoFocus
            style={{
              border: `1px solid ${C.accent}`, background: 'transparent',
              borderRadius: 999, padding: '3px 11px', fontSize: 12.5,
              color: C.text, fontFamily: 'inherit', width: 150, outline: 'none',
            }}
          />
          <button
            onClick={save}
            disabled={!name.trim()}
            style={{
              background: 'transparent', border: 'none', padding: 0,
              color: C.accent, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Save
          </button>
        </span>
      ) : (
        worthSaving && !active && (
          <button
            onClick={() => setNaming(true)}
            style={{
              border: `1px dashed ${C.border}`, background: 'transparent',
              color: C.faint, borderRadius: 999, padding: '3px 11px',
              fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Save this view
          </button>
        )
      )}
    </div>
  );
}
