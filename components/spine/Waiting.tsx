'use client';

/**
 * Who you are waiting on, in one line, with a way to end it.
 *
 * This was three sentences inside the brief's "what is stuck" paragraph. It
 * took a quarter of the screen to say four words, it could not be sorted or
 * counted, and the only way to change it was to rewrite the paragraph around
 * it. So it never got changed, and a stale block of prose is worse than an
 * empty one because it is read as current.
 *
 * The date is the part that does the work. "Waiting on John" is a note.
 * "Waiting on John, 12 days" is a decision about whether to pick up the phone.
 */

import { useCallback, useEffect, useState } from 'react';
import supabase from '@/lib/supabase';
import { C, inputStyle } from './ui';

/** Whole days, floored. Same-day reads as today rather than 0 days. */
function daysSince(iso: string): number {
  const then = new Date(`${iso}T00:00:00`);
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((midnight.getTime() - then.getTime()) / 86400000));
}

export function Waiting({ customerId }: { customerId: string }) {
  const [what, setWhat] = useState<string | null>(null);
  const [since, setSince] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const res = await supabase
      .from('customers')
      .select('waiting_on, awaiting_reply_since')
      .eq('id', customerId)
      .maybeSingle();
    if (res.data) {
      setWhat(res.data.waiting_on ?? null);
      setSince(res.data.awaiting_reply_since ?? null);
      setDraft(res.data.waiting_on ?? '');
    }
    setLoaded(true);
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  const save = async (text: string | null) => {
    const clean = text?.trim() || null;
    await supabase
      .from('customers')
      .update({
        waiting_on: clean,
        // Starting a wait stamps it; ending one clears it. The date is never
        // typed, because a date somebody has to remember to type is a date
        // that ends up wrong.
        awaiting_reply_since: clean ? (since ?? new Date().toISOString().slice(0, 10)) : null,
      })
      .eq('id', customerId);
    setEditing(false);
    load();
  };

  if (!loaded) return null;

  const days = since ? daysSince(since) : null;
  // Two weeks is where a wait stops being normal and starts being a problem.
  const overdue = days !== null && days >= 14;

  if (!what && !editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        style={{
          border: 'none', background: 'transparent', padding: 0, marginBottom: 14,
          fontSize: 12.5, color: C.faint, cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        + Waiting on something?
      </button>
    );
  }

  if (editing) {
    return (
      <div style={{ display: 'flex', gap: 7, marginBottom: 14, flexWrap: 'wrap' }}>
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save(draft);
            if (e.key === 'Escape') { setDraft(what ?? ''); setEditing(false); }
          }}
          placeholder="Directors and officers, which blocks the organizational meeting"
          style={{ ...inputStyle, flex: '1 1 280px', fontSize: 13 }}
        />
        <button
          onClick={() => save(draft)}
          style={{
            border: 'none', background: 'transparent', padding: '0 6px',
            color: C.accent, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Save
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap',
        marginBottom: 14, padding: '7px 11px', borderRadius: 7,
        background: overdue ? C.amberSoft : C.panelAlt,
        border: `1px solid ${overdue ? C.amber + '44' : C.border}`,
      }}
    >
      <span style={{ fontSize: 12.5, color: overdue ? C.amber : C.faint, flexShrink: 0 }}>
        Waiting
      </span>
      <span style={{ fontSize: 13, color: C.text, flex: 1, minWidth: 160 }}>{what}</span>
      {days !== null && (
        <span style={{ fontSize: 12.5, color: overdue ? C.amber : C.faint, flexShrink: 0 }}>
          {days === 0 ? 'today' : `${days} day${days === 1 ? '' : 's'}`}
        </span>
      )}
      <button
        onClick={() => setEditing(true)}
        style={{
          border: 'none', background: 'transparent', padding: 0,
          color: C.dim, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        Change
      </button>
      {/* The thing the paragraph version could never do. */}
      <button
        onClick={() => save(null)}
        style={{
          border: 'none', background: 'transparent', padding: 0,
          color: C.accent, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        Got it
      </button>
    </div>
  );
}
