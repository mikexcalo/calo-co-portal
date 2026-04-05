'use client';

import { useEffect } from 'react';
import { Typography as TypographyType } from '@/lib/types';
import { useTheme } from '@/lib/theme';

interface TypographyProps {
  fonts: TypographyType;
  readOnly: boolean;
  onFontChange?: (type: 'heading' | 'body' | 'accent', value: string) => void;
}

export default function Typography({ fonts, readOnly, onFontChange }: TypographyProps) {
  const { t } = useTheme();

  // Load Google Fonts dynamically
  useEffect(() => {
    const names = [fonts.heading, fonts.body, fonts.accent].filter(Boolean);
    if (names.length === 0) return;
    const url = `https://fonts.googleapis.com/css2?${names.map((f) => `family=${f.replace(/ /g, '+')}`).join('&')}&display=swap`;
    const link = document.createElement('link');
    link.href = url; link.rel = 'stylesheet';
    document.head.appendChild(link);
    return () => { try { document.head.removeChild(link); } catch {} };
  }, [fonts.heading, fonts.body, fonts.accent]);

  const inputStyle = (fontValue: string): React.CSSProperties => ({
    width: '100%', padding: '8px 10px', fontSize: 13,
    border: `1px solid ${t.border.default}`, borderRadius: t.radius.sm,
    background: t.bg.primary, color: t.text.primary,
    fontFamily: fontValue ? `'${fontValue}', inherit` : 'inherit',
    outline: 'none', transition: 'border-color 150ms',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[
        { key: 'heading' as const, label: 'Heading', placeholder: 'e.g. Playfair Display', value: fonts.heading },
        { key: 'body' as const, label: 'Body', placeholder: 'e.g. Inter', value: fonts.body },
        { key: 'accent' as const, label: 'Accent', placeholder: 'e.g. Dancing Script', value: fonts.accent },
      ].map((f) => (
        <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: t.text.secondary, width: 54, flexShrink: 0 }}>{f.label}</span>
          <input type="text" value={f.value || ''} onChange={(e) => onFontChange?.(f.key, e.target.value)}
            placeholder={f.placeholder} disabled={readOnly} style={{ ...inputStyle(f.value), flex: 1 }}
            onFocus={(e) => e.currentTarget.style.borderColor = t.border.active}
            onBlur={(e) => e.currentTarget.style.borderColor = t.border.default} />
        </div>
      ))}
    </div>
  );
}
