'use client';

import { useState } from 'react';
import { useTheme } from '@/lib/theme';

type AddContactInlineProps = {
  onSave: (data: { name: string; role?: string; email?: string; phone?: string; isPrimaryContact: boolean; isBillingContact: boolean }) => Promise<void>;
  onCancel: () => void;
  saving?: boolean;
};

export function AddContactInline({ onSave, onCancel, saving = false }: AddContactInlineProps) {
  const { t } = useTheme();
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [isBilling, setIsBilling] = useState(false);

  const canSave = name.trim().length > 0 && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    await onSave({
      name: name.trim(),
      role: role.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      isPrimaryContact: isPrimary,
      isBillingContact: isBilling,
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
      padding: 16, marginTop: 8,
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: t.text.secondary, marginBottom: 12 }}>
        New contact
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        <label style={labelStyle}>
          Name <span style={{ color: t.status?.danger || '#DC2626' }}>*</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" style={{ ...inputStyle, marginTop: 3 }} />
        </label>

        <label style={labelStyle}>
          Role
          <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Creative Director" style={{ ...inputStyle, marginTop: 3 }} />
        </label>

        <label style={labelStyle}>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" style={{ ...inputStyle, marginTop: 3 }} />
        </label>

        <label style={labelStyle}>
          Phone
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-5555" style={{ ...inputStyle, marginTop: 3 }} />
        </label>

        <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: t.text.secondary, cursor: 'pointer' }}>
            <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} />
            Primary contact
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: t.text.secondary, cursor: 'pointer' }}>
            <input type="checkbox" checked={isBilling} onChange={(e) => setIsBilling(e.target.checked)} />
            Billing contact
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
            {saving ? 'Saving...' : 'Save contact'}
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
    </div>
  );
}
