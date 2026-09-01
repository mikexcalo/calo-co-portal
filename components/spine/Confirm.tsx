'use client';

/**
 * Are you sure.
 *
 * Used for anything that destroys something. Deliberately NOT the browser's
 * confirm(): that blocks the whole page, can't say what is about to be lost,
 * and on a phone renders as a system alert people dismiss by reflex.
 *
 * Two details that matter:
 *  - The confirm button names the action ("Delete file"), not "OK". People
 *    read buttons, not paragraphs.
 *  - Cancel is the default focus and Escape cancels, so the safe outcome is
 *    the one you get by doing nothing.
 */

import { useEffect, useRef } from 'react';
import { Button, C, radius } from './ui';

export function Confirm({
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
  busy,
}: {
  title: string;
  body?: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const cancelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    cancelRef.current?.querySelector('button')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <>
      <div
        onClick={onCancel}
        style={{ position: 'fixed', inset: 0, background: 'rgba(20,18,16,.45)', zIndex: 80 }}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(400px, calc(100vw - 32px))',
          background: C.panel,
          border: `1px solid ${C.border}`,
          borderRadius: radius.lg,
          zIndex: 81,
          padding: 22,
          boxShadow: '0 20px 50px rgba(0,0,0,.18)',
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 600, color: C.text }}>{title}</div>
        {body && (
          <p style={{ fontSize: 14, color: C.dim, lineHeight: 1.55, margin: '10px 0 0' }}>
            {body}
          </p>
        )}
        <div
          ref={cancelRef}
          style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}
        >
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </div>
      </div>
    </>
  );
}
