'use client';

import { useState } from 'react';
import { useTheme } from '@/lib/theme';
import { AddContactInline } from './AddContactInline';

type ClientOption = { id: string; name: string };

type AddContactWithClientPickerProps = {
  clients: ClientOption[];
  onSave: (clientId: string, data: { name: string; role?: string; email?: string; phone?: string; isPrimaryContact: boolean; isBillingContact: boolean }) => Promise<void>;
  onCancel: () => void;
  saving?: boolean;
};

export function AddContactWithClientPicker({ clients, onSave, onCancel, saving = false }: AddContactWithClientPickerProps) {
  const { t } = useTheme();
  const [selectedClientId, setSelectedClientId] = useState('');

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', fontSize: 13,
    border: `1px solid ${t.border.default}`, borderRadius: 6,
    fontFamily: 'inherit', background: t.bg.primary, color: t.text.primary,
    outline: 'none', boxSizing: 'border-box',
    appearance: 'none' as const,
    backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 12 12%27%3E%3Cpath d=%27M3 5l3 3 3-3%27 fill=%27none%27 stroke=%27%236b7280%27 stroke-width=%271.5%27/%3E%3C/svg%3E")',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 8px center',
    paddingRight: 24,
  };

  if (!selectedClientId) {
    return (
      <div style={{
        background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 8,
        padding: 16, marginBottom: 20,
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: t.text.secondary, marginBottom: 12 }}>
          New contact
        </div>
        <label style={{ fontSize: 11, fontWeight: 500, color: t.text.secondary, display: 'block', marginBottom: 8 }}>
          Client <span style={{ color: '#DC2626' }}>*</span>
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            style={{ ...inputStyle, marginTop: 3 }}
            autoFocus
          >
            <option value="">Select a client...</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
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
    );
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 8,
        borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
        padding: '8px 16px', fontSize: 11, color: t.text.tertiary,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span>Adding to: <strong style={{ color: t.text.secondary }}>{clients.find((c) => c.id === selectedClientId)?.name}</strong></span>
        <button
          onClick={() => setSelectedClientId('')}
          style={{ fontSize: 11, color: t.text.tertiary, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}
        >
          Change
        </button>
      </div>
      <div style={{ marginTop: -1 }}>
        <AddContactInline
          saving={saving}
          onCancel={onCancel}
          onSave={async (data) => {
            await onSave(selectedClientId, data);
          }}
        />
      </div>
    </div>
  );
}
