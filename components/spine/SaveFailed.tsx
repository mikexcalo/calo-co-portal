'use client';

/**
 * Says when something did not save.
 *
 * Sits above everything, disappears on its own, and can be dismissed. It
 * exists because the alternative — every screen growing its own error state —
 * is how half of them ended up with none.
 */

import { useEffect, useState } from 'react';
import { SAVE_FAILED } from '@/lib/spine/save';
import { C } from './ui';

export function SaveFailed() {
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ message: string; what: string | null }>).detail;
      setMsg(d?.what ? `${d.what} — ${d.message}` : d?.message ?? 'That did not save.');
      clearTimeout(timer);
      timer = setTimeout(() => setMsg(null), 9000);
    };
    window.addEventListener(SAVE_FAILED, on);
    return () => { window.removeEventListener(SAVE_FAILED, on); clearTimeout(timer); };
  }, []);

  if (!msg) return null;

  return (
    <div
      role="status"
      style={{
        position: 'fixed', left: '50%', transform: 'translateX(-50%)',
        bottom: 24, zIndex: 9999, maxWidth: 520,
        background: C.ink, color: '#fff', borderRadius: 10,
        padding: '11px 14px', fontSize: 13.5, lineHeight: 1.5,
        boxShadow: '0 10px 34px rgba(0,0,0,.28)',
        display: 'flex', gap: 12, alignItems: 'flex-start',
      }}
    >
      <span style={{ flex: 1 }}>{msg}</span>
      <button
        onClick={() => setMsg(null)}
        style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,.7)', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', padding: 0 }}
      >
        Dismiss
      </button>
    </div>
  );
}
