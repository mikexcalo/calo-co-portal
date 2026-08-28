'use client';

/**
 * Undo.
 *
 * Confirmations stop the wrong click. They do nothing for the right click on
 * the wrong row — which is the mistake people actually make, and the one they
 * notice half a second later.
 *
 * So destructive actions that CAN be reversed offer a window to reverse them.
 * The bar sits at the bottom of the screen, does not block anything, and
 * disappears on its own. Nothing to dismiss, nothing to learn.
 *
 * Only for actions that genuinely restore. Anything irreversible — a deleted
 * file, a sent email — keeps its confirmation and gets no undo, because an
 * undo button that cannot undo is a lie.
 */

import { useEffect, useRef, useState } from 'react';
import { C, radius } from './ui';

export interface UndoState {
  message: string;
  /** Must actually put things back. Called at most once. */
  restore: () => Promise<void>;
}

export function UndoBar({
  undo,
  onDone,
  seconds = 8,
}: {
  undo: UndoState | null;
  onDone: () => void;
  seconds?: number;
}) {
  const [left, setLeft] = useState(seconds);
  const [busy, setBusy] = useState(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (!undo) return;
    setLeft(seconds);
    const t = setInterval(() => {
      setLeft((n) => {
        if (n <= 1) {
          clearInterval(t);
          doneRef.current();
          return 0;
        }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [undo, seconds]);

  if (!undo) return null;

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 24,
        transform: 'translateX(-50%)',
        zIndex: 65,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        background: C.ink,
        color: '#fff',
        padding: '11px 14px 11px 18px',
        borderRadius: radius.lg,
        boxShadow: '0 10px 30px rgba(0,0,0,.25)',
        maxWidth: 'calc(100vw - 32px)',
      }}
    >
      <span style={{ fontSize: 13.5 }}>{undo.message}</span>
      <button
        onClick={async () => {
          setBusy(true);
          try {
            await undo.restore();
          } finally {
            setBusy(false);
            onDone();
          }
        }}
        disabled={busy}
        style={{
          background: 'transparent',
          border: '1px solid rgba(255,255,255,.35)',
          color: '#fff',
          borderRadius: radius.md,
          padding: '5px 13px',
          fontSize: 12.5,
          fontWeight: 600,
          cursor: busy ? 'wait' : 'pointer',
          fontFamily: 'inherit',
          whiteSpace: 'nowrap',
        }}
      >
        {busy ? 'Restoring…' : `Undo (${left})`}
      </button>
    </div>
  );
}
