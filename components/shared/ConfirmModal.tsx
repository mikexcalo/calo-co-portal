'use client';

import { useEffect } from 'react';

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
      background: 'rgba(0,0,0,0.3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'fadeIn 150ms ease',
    }} onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 12, padding: 20,
        maxWidth: 400, width: '90%', boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
      }}>
        <p style={{ fontSize: 16, fontWeight: 600, color: '#111827', margin: '0 0 8px' }}>{title}</p>
        <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 20px', lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          {!alertOnly && (
            <button onClick={onCancel} style={{
              padding: '8px 16px', fontSize: 13, fontWeight: 500,
              border: '1px solid #d1d5db', borderRadius: 8,
              background: '#fff', color: '#374151', cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
            }}>{cancelLabel}</button>
          )}
          <button onClick={onConfirm} style={{
            padding: '8px 16px', fontSize: 13, fontWeight: 500,
            border: 'none', borderRadius: 8, cursor: 'pointer',
            background: destructive ? '#DC2626' : '#2563eb',
            color: '#fff', fontFamily: 'Inter, sans-serif',
          }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
