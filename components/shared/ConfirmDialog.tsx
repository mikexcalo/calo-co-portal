'use client';

import { useTheme } from '@/lib/theme';

type ConfirmDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body: string;
  confirmLabel?: string;
  confirmStyle?: 'destructive' | 'primary';
  loading?: boolean;
};

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel = 'Delete',
  confirmStyle = 'destructive',
  loading = false,
}: ConfirmDialogProps) {
  const { t } = useTheme();

  if (!isOpen) return null;

  const confirmBg = confirmStyle === 'destructive' ? '#DC2626' : t.accent.primary;
  const confirmHoverBg = confirmStyle === 'destructive' ? '#B91C1C' : '#000';

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100 }}
        onClick={onClose}
      />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 400, background: t.bg.surface, border: `1px solid ${t.border.default}`,
        borderRadius: 12, padding: 24, zIndex: 101, boxShadow: t.shadow.elevated,
      }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: t.text.primary, marginBottom: 8 }}>
          {title}
        </div>
        <div style={{ fontSize: 14, color: t.text.tertiary, lineHeight: 1.5, marginBottom: 20 }}>
          {body}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              height: 32, padding: '0 16px', fontSize: 13, fontWeight: 500,
              background: 'transparent', color: t.text.secondary,
              border: `1px solid ${t.border.default}`, borderRadius: 6,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = confirmHoverBg; }}
            onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = confirmBg; }}
            style={{
              height: 32, padding: '0 16px', fontSize: 13, fontWeight: 500,
              background: confirmBg, color: '#fff',
              border: 'none', borderRadius: 6,
              cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Deleting...' : confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}
