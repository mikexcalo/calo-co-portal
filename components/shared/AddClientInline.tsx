'use client';

import { useState } from 'react';
import { useTheme } from '@/lib/theme';

type AddClientInlineProps = {
  onSave: (data: { name: string; website?: string; lifecycleStage: string }) => Promise<void>;
  onCancel: () => void;
  saving?: boolean;
};

export function AddClientInline({ onSave, onCancel, saving = false }: AddClientInlineProps) {
  const { t } = useTheme();
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [stage, setStage] = useState('active');

  const canSave = name.trim().length > 0 && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    await onSave({
      name: name.trim(),
      website: website.trim() || undefined,
      lifecycleStage: stage,
    });
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', fontSize: 13,
    border: `1px solid ${t.border.default}`, borderRadius: 6,
    fontFamily: 'inherit', background: t.bg.primary, color: t.text.primary,
    outline: 'none', boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 500, color: t.text.secondary, display: 'block', marginBottom: 8,
  };

  return (
    <div style={{
      background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 8,
      padding: 16, marginBottom: 20,
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: t.text.secondary, marginBottom: 12 }}>
        New client
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 0 }}>
        <label style={{ ...labelStyle, flex: 1 }}>
          Name <span style={{ color: '#DC2626' }}>*</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Company or client name" style={{ ...inputStyle, marginTop: 3 }} autoFocus />
        </label>
        <label style={{ ...labelStyle, flex: 1 }}>
          Website
          <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="example.com" style={{ ...inputStyle, marginTop: 3 }} />
        </label>
        <label style={{ ...labelStyle, width: 130, flexShrink: 0 }}>
          Stage
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            style={{
              ...inputStyle, marginTop: 3,
              appearance: 'none' as const,
              backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 12 12%27%3E%3Cpath d=%27M3 5l3 3 3-3%27 fill=%27none%27 stroke=%27%236b7280%27 stroke-width=%271.5%27/%3E%3C/svg%3E")',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 8px center',
              paddingRight: 24,
            }}
          >
            <option value="lead">Lead</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="churned">Churned</option>
          </select>
        </label>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleSave}
          disabled={!canSave}
          style={{
            height: 30, padding: '0 14px', fontSize: 12, fontWeight: 500,
            background: canSave ? t.accent.primary : t.bg.surfaceHover,
            color: canSave ? '#fff' : t.text.tertiary,
            border: 'none', borderRadius: 6, cursor: canSave ? 'pointer' : 'default',
            fontFamily: 'inherit',
          }}
        >
          {saving ? 'Saving...' : 'Save client'}
        </button>
        <button
          onClick={onCancel}
          style={{
            height: 30, padding: '0 14px', fontSize: 12, fontWeight: 500,
            background: 'transparent', color: t.text.secondary,
            border: `1px solid ${t.border.default}`, borderRadius: 6,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
