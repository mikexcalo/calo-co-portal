'use client';
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '@/lib/theme';

type ToastType = 'success' | 'error';

interface ToastProps {
  message: string;
  type: ToastType;
  action?: { label: string; onClick: () => void };
  onDismiss: () => void;
}

export type { ToastProps, ToastType };

export default function Toast({ message, type, action, onDismiss }: ToastProps) {
  const { t } = useTheme();
  useEffect(() => { const timer = setTimeout(onDismiss, 4000); return () => clearTimeout(timer); }, [onDismiss]);

  const icon = type === 'success'
    ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00C9A0" strokeWidth="2" strokeLinecap="round"><polyline points="4 12 9 17 20 6"/></svg>
    : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5"/><circle cx="12" cy="16" r="0.5" fill="#f87171"/></svg>;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
        background: t.bg.elevated, border: `0.5px solid ${t.border.default}`, borderRadius: 8,
        boxShadow: t.shadow.elevated, fontSize: 13, color: t.text.primary, fontFamily: 'inherit' }}>
      {icon}
      <span>{message}</span>
      {action && <span onClick={action.onClick} style={{ fontSize: 11, color: t.accent.text, cursor: 'pointer', fontWeight: 600, marginLeft: 8 }}>{action.label}</span>}
    </motion.div>
  );
}
