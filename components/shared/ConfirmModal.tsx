'use client';

import { useEffect } from 'react';
import { useTheme } from '@/lib/theme';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
  alertOnly?: boolean;
}

export default function ConfirmModal({
  isOpen, title, message,
  confirmLabel = 'OK', cancelLabel = 'Cancel',
  onConfirm, onCancel, destructive = false, alertOnly = false,
}: ConfirmModalProps) {
  const { t } = useTheme();

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onCancel, onConfirm]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: t.bg.elevated, borderRadius: 12, padding: 20,
        border: `1px solid ${t.border.default}`,
        maxWidth: 400, width: '90%', boxShadow: t.shadow.elevated,
      }}>
        <p style={{ fontSize: 16, fontWeight: 600, color: t.text.primary, margin: '0 0 8px' }}>{title}</p>
        <p style={{ fontSize: 14, color: t.text.secondary, margin: '0 0 20px', lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          {!alertOnly && (
            <button onClick={onCancel} style={{
              padding: '8px 16px', fontSize: 13, fontWeight: 500,
              border: `1px solid ${t.border.default}`, borderRadius: 8,
              background: t.bg.surface, color: t.text.primary, cursor: 'pointer',
              fontFamily: 'inherit',
            }}>{cancelLabel}</button>
          )}
          <button onClick={onConfirm} style={{
            padding: '8px 16px', fontSize: 13, fontWeight: 500,
            border: 'none', borderRadius: 8, cursor: 'pointer',
            background: destructive ? t.status.danger : t.accent.primary,
            color: '#fff', fontFamily: 'inherit',
          }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
