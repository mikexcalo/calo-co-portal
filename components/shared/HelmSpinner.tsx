'use client';

import { useTheme } from '@/lib/theme';

export default function HelmSpinner() {
  const { t } = useTheme();
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        opacity: 1,
        zIndex: 10,
        pointerEvents: 'none',
      }}
    >
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke={t.text.tertiary}
        strokeWidth="1.2"
        strokeLinecap="round"
        style={{ animation: 'helm-spin 2s linear infinite' }}
      >
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="12" cy="12" r="3" />
        <line x1="12" y1="3.5" x2="12" y2="9" />
        <line x1="12" y1="15" x2="12" y2="20.5" />
        <line x1="3.5" y1="12" x2="9" y2="12" />
        <line x1="15" y1="12" x2="20.5" y2="12" />
        <line x1="5.9" y1="5.9" x2="9.9" y2="9.9" />
        <line x1="14.1" y1="14.1" x2="18.1" y2="18.1" />
        <line x1="5.9" y1="18.1" x2="9.9" y2="14.1" />
        <line x1="14.1" y1="9.9" x2="18.1" y2="5.9" />
      </svg>
    </div>
  );
}
