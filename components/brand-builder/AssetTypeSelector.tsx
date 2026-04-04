'use client';

import { AssetType, ASSET_TYPES } from './types';

interface AssetTypeSelectorProps {
  selected: AssetType | null;
  onSelect: (type: AssetType) => void;
}

export default function AssetTypeSelector({ selected, onSelect }: AssetTypeSelectorProps) {
  // Once an asset is selected, collapse to a single row of pills
  if (selected) {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {ASSET_TYPES.map((t) => {
          const isActive = selected === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              style={{
                background: isActive ? '#2563eb' : '#f1f5f9',
                color: isActive ? '#ffffff' : '#475569',
                border: isActive ? '1px solid #2563eb' : '1px solid #e2e8f0',
                borderRadius: 20,
                padding: '5px 12px',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 600,
                fontFamily: 'inherit',
                transition: 'all 0.12s',
                whiteSpace: 'nowrap',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    );
  }

  // Initial 2-column grid when nothing is selected
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
      {ASSET_TYPES.map((t) => (
        <button
          key={t.id}
          onClick={() => onSelect(t.id)}
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '10px 12px',
            cursor: 'pointer',
            textAlign: 'left',
            fontFamily: 'inherit',
            transition: 'all 0.12s',
          }}
        >
          <div style={{ fontSize: 18, marginBottom: 2 }}>{t.icon}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', marginBottom: 1 }}>
            {t.label}
          </div>
          <div style={{ fontSize: 9.5, color: '#94a3b8' }}>{t.description}</div>
        </button>
      ))}
    </div>
  );
}
