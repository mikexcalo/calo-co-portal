'use client';

import { useState } from 'react';
import { useTheme } from '@/lib/theme';

type ComposerProps = {
  onSave: (content: string) => Promise<void>;
  placeholder?: string;
  saving?: boolean;
};

export function Composer({ onSave, placeholder = 'Add a note...', saving = false }: ComposerProps) {
  const [value, setValue] = useState('');
  const { t } = useTheme();
  const canSave = value.trim().length > 0 && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    const content = value.trim();
    setValue('');
    await onSave(content);
  };

  return (
    <div style={{
      border: `1px solid ${t.border.default}`, borderRadius: 8,
      background: t.bg.surface, overflow: 'hidden',
    }}>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', minHeight: 60, padding: 16, border: 'none',
          background: 'transparent', fontSize: 14, color: t.text.primary,
          fontFamily: 'inherit', resize: 'vertical', outline: 'none',
          lineHeight: 1.5, boxSizing: 'border-box',
        }}
      />
      <div style={{
        borderTop: `0.5px solid ${t.border.default}`,
        padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 12, color: t.text.tertiary, fontWeight: 500 }}>Note</span>
        <button
          onClick={handleSave}
          disabled={!canSave}
          style={{
            height: 28, padding: '0 14px', fontSize: 12, fontWeight: 500,
            background: canSave ? t.accent.primary : t.bg.surfaceHover,
            color: canSave ? '#fff' : t.text.tertiary,
            border: 'none', borderRadius: 6, cursor: canSave ? 'pointer' : 'default',
            fontFamily: 'inherit', transition: 'all 150ms',
          }}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
