'use client';

import { useTheme } from '@/lib/theme';

export default function ContentFooter() {
  const { t } = useTheme();
  return (
    <div style={{
      height: 28, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: t.bg.primary,
    }}>
      <a href="https://mikecalo.co" target="_blank" rel="noopener noreferrer"
        style={{ fontSize: 9, color: t.text.tertiary, textDecoration: 'none', fontFamily: 'inherit' }}>
        Powered by Manifest
      </a>
    </div>
  );
}
