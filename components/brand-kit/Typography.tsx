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

  const labelStyle: React.CSSProperties = { fontSize: 11, color: t.text.secondary, display: 'block', marginBottom: 4 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <label style={labelStyle}>Heading</label>
        <input type="text" value={fonts.heading || ''} onChange={(e) => onFontChange?.('heading', e.target.value)}
          placeholder="e.g. Playfair Display" disabled={readOnly} style={inputStyle(fonts.heading)}
          onFocus={(e) => e.currentTarget.style.borderColor = t.border.active}
          onBlur={(e) => e.currentTarget.style.borderColor = t.border.default} />
      </div>
      <div>
        <label style={labelStyle}>Body</label>
        <input type="text" value={fonts.body || ''} onChange={(e) => onFontChange?.('body', e.target.value)}
          placeholder="e.g. Inter" disabled={readOnly} style={inputStyle(fonts.body)}
          onFocus={(e) => e.currentTarget.style.borderColor = t.border.active}
          onBlur={(e) => e.currentTarget.style.borderColor = t.border.default} />
      </div>
      <div>
        <label style={labelStyle}>Accent</label>
        <input type="text" value={fonts.accent || ''} onChange={(e) => onFontChange?.('accent', e.target.value)}
          placeholder="e.g. Dancing Script" disabled={readOnly} style={inputStyle(fonts.accent)}
          onFocus={(e) => e.currentTarget.style.borderColor = t.border.active}
          onBlur={(e) => e.currentTarget.style.borderColor = t.border.default} />
      </div>
    </div>
  );
}
