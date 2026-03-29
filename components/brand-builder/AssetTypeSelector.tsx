'use client';

import { AssetType, ASSET_TYPES } from './types';

interface AssetTypeSelectorProps {
  selected: AssetType | null;
  onSelect: (type: AssetType) => void;
}

export default function AssetTypeSelector({ selected, onSelect }: AssetTypeSelectorProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
      {ASSET_TYPES.map((t) => {
        const isActive = selected === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            style={{
              background: isActive ? '#eff6ff' : '#ffffff',
              border: isActive ? '2px solid #2563eb' : '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '10px 12px',
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: 'Inter, sans-serif',
              transition: 'all 0.12s',
            }}
          >
            <div style={{ fontSize: 18, marginBottom: 2 }}>{t.icon}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: isActive ? '#2563eb' : '#0f172a', marginBottom: 1 }}>
              {t.label}
            </div>
            <div style={{ fontSize: 9.5, color: '#94a3b8' }}>{t.description}</div>
          </button>
        );
      })}
    </div>
  );
}
