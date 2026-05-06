'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/lib/theme';
import { FormSection, FormRow, FormField } from '@/components/shared/Brand';
import type { Client, Contact } from '@/lib/types';

type ClientEditPanelProps = {
  client: Client;
  primaryContact: Contact | null;
  onSave: (data: {
    company: string; code: string; website: string;
    address_line_1: string; address_line_2: string; city: string; state: string; postal_code: string;
    firstName: string; lastName: string; title: string; email: string; contactPhone: string; businessPhone: string;
  }) => Promise<void>;
  onCancel: () => void;
  saving?: boolean;
};

const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

export function ClientEditPanel({ client, primaryContact, onSave, onCancel, saving = false }: ClientEditPanelProps) {
  const { t } = useTheme();
  const parts = (primaryContact?.name || '').split(/\s+/);

  const [form, setForm] = useState({
    company: client.company || client.name || '',
    code: (client as any).code || '',
    website: client.website || '',
    address_line_1: client.address_line_1 || '',
    address_line_2: client.address_line_2 || '',
    city: client.city || '',
    state: client.state || '',
    postal_code: client.postal_code || '',
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' ') || '',
    title: primaryContact?.title || primaryContact?.role || '',
    email: primaryContact?.email || client.email || '',
    contactPhone: primaryContact?.phone || '',
    businessPhone: client.phone || '',
  });
  const [submitted, setSubmitted] = useState(false);

  const valid = {
    company: form.company.trim().length > 0,
    firstName: form.firstName.trim().length > 0,
    lastName: form.lastName.trim().length > 0,
    email: form.email.trim().length > 0 && form.email.includes('@'),
  };

  const canSave = valid.company && valid.firstName && valid.lastName && valid.email && !saving;

  const handleSave = async () => {
    setSubmitted(true);
    if (!canSave) return;
    await onSave(form);
  };

  const selectStyle: React.CSSProperties = {
    width: '100%', background: t.bg.primary, border: `1px solid ${t.border.default}`,
    borderRadius: 8, padding: '8px 12px', fontSize: 13, color: t.text.primary,
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
    appearance: 'none' as const,
    backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 12 12%27%3E%3Cpath d=%27M3 5l3 3 3-3%27 fill=%27none%27 stroke=%27%236b7280%27 stroke-width=%271.5%27/%3E%3C/svg%3E")',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 10px center',
    paddingRight: 28,
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <FormSection label="Client info">
        <FormRow>
          <FormField label="Company name *" value={form.company} onChange={(v) => setForm({ ...form, company: v })} />
          <FormField label="Client code" value={form.code} onChange={(v) => setForm({ ...form, code: v.toUpperCase().slice(0, 5) })} placeholder="MMTH" />
        </FormRow>
        <FormRow>
          <FormField label="Website" value={form.website} onChange={(v) => setForm({ ...form, website: v })} placeholder="example.com" />
          <FormField label="Business phone" value={form.businessPhone} onChange={(v) => setForm({ ...form, businessPhone: v })} type="tel" />
        </FormRow>
        <div style={{ fontSize: 11, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 8 }}>Address</div>
        <FormRow>
          <FormField label="Street address" value={form.address_line_1} onChange={(v) => setForm({ ...form, address_line_1: v })} />
        </FormRow>
        <FormRow>
          <FormField label="Apt / Suite / Unit" value={form.address_line_2} onChange={(v) => setForm({ ...form, address_line_2: v })} />
        </FormRow>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
          <FormField label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: t.text.secondary, marginBottom: 4 }}>State</div>
            <select value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} style={selectStyle}>
              <option value="">—</option>
              {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <FormField label="Zip" value={form.postal_code} onChange={(v) => setForm({ ...form, postal_code: v })} />
        </div>
      </FormSection>

      <FormSection label="Primary contact">
        <FormRow>
          <FormField label="First name *" value={form.firstName} onChange={(v) => setForm({ ...form, firstName: v })} />
          <FormField label="Last name *" value={form.lastName} onChange={(v) => setForm({ ...form, lastName: v })} />
        </FormRow>
        <FormRow>
          <FormField label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} placeholder="e.g. Owner" />
          <FormField label="Email *" value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" />
        </FormRow>
        <FormRow>
          <FormField label="Contact phone" value={form.contactPhone} onChange={(v) => setForm({ ...form, contactPhone: v })} type="tel" />
        </FormRow>
      </FormSection>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleSave}
          disabled={!canSave}
          style={{
            height: 32, padding: '0 16px', fontSize: 13, fontWeight: 500,
            background: canSave ? t.accent.primary : t.bg.surfaceHover,
            color: canSave ? '#fff' : t.text.tertiary,
            border: 'none', borderRadius: 8, cursor: canSave ? 'pointer' : 'default',
            fontFamily: 'inherit',
          }}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={onCancel}
          style={{
            height: 32, padding: '0 16px', fontSize: 13, fontWeight: 500,
            background: 'transparent', color: t.text.secondary,
            border: `1px solid ${t.border.default}`, borderRadius: 8,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
