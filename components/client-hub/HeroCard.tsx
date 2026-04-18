'use client';

import { useState } from 'react';
import { Client, Contact } from '@/lib/types';
import { saveClient, saveContact, DB } from '@/lib/database';
import ContactChips from './ContactChips';

interface HeroCardProps {
  client: Client;
  contacts: Contact[];
  isClient: boolean;
  onClientUpdate: (client: Client) => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', fontSize: 13, marginTop: 4,
  border: '1px solid #e2e8f0', borderRadius: 8, fontFamily: 'inherit',
};
const errorInputStyle: React.CSSProperties = { ...inputStyle, borderColor: '#ef4444' };
const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#334155', display: 'block' };
const req = <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>;

export default function HeroCard({ client, contacts, isClient, onClientUpdate }: HeroCardProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const primary = contacts.find((c) => c.isPrimary) || contacts[0];

  // Split primary name into first/last
  const nameParts = (primary?.name || '').split(/\s+/);
  const [form, setForm] = useState({
    company: client.company || client.name || '',
    firstName: nameParts[0] || '',
    lastName: nameParts.slice(1).join(' ') || '',
    title: primary?.title || primary?.role || '',
    email: primary?.email || client.email || '',
    contactPhone: primary?.phone || '',
    businessPhone: client.phone || '',
    address: client.address || '',
    website: client.website || '',
    notes: '',
  });

  const valid = {
    company: form.company.trim().length > 0,
    firstName: form.firstName.trim().length > 0,
    lastName: form.lastName.trim().length > 0,
    email: form.email.trim().length > 0 && form.email.includes('@'),
  };

  // Missing alerts: only mandatory contact fields + module-level items
  const missing: string[] = [];
  if (!primary?.name || !primary.name.includes(' ')) {
    // First + last name not both present
    if (!nameParts[0]) missing.push('First Name');
    if (!nameParts[1]) missing.push('Last Name');
  }
  if (!primary?.email && !client.email) missing.push('Email');
  // Module-level — Brand Kit only, Email Signature is optional (#12)
  const bk = client.brandKit;
  const hasLogos = bk && Object.values(bk.logos || {}).some((a: any) => a?.length > 0);
  if (!hasLogos) missing.push('Brand Kit logos');
  if (!bk?.colors?.length) missing.push('Brand colors');

  const handleSave = async () => {
    setSubmitted(true);
    if (!valid.company || !valid.firstName || !valid.lastName || !valid.email) return;

    setSaving(true);
    const updated = {
      ...client, company: form.company, name: form.company,
      email: form.email, phone: form.businessPhone,
      website: form.website, address: form.address,
    };
    await saveClient(updated);

    // Update or create primary contact
    const contactName = `${form.firstName.trim()} ${form.lastName.trim()}`;
    if (primary?.id) {
      await saveContact({
        id: primary.id, clientId: client.id, name: contactName,
        role: form.title, email: form.email, phone: form.contactPhone,
        isPrimary: true,
      });
    } else {
      const newContact = await saveContact({
        clientId: client.id, name: contactName,
        role: form.title, email: form.email, phone: form.contactPhone,
        isPrimary: true,
      });
      if (newContact) DB.contacts[client.id] = [newContact];
    }

    onClientUpdate(updated);
    setIsEditOpen(false);
    setSaving(false);
  };

  const clientLogo = client.logo ? (
    <img src={client.logo} alt={client.name} style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover' }} />
  ) : (
    <div style={{
      width: 56, height: 56, borderRadius: 8, background: '#e2e8f0',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 20, fontWeight: 700, color: '#475569',
    }}>
      {(client.company || client.name).charAt(0).toUpperCase()}
    </div>
  );

  // Client View
  if (isClient) {
    return (
      <div className="client-hd-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {clientLogo}
          <div>
            <div className="client-hd-name">{client.company || client.name}</div>
            {primary && <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{primary.name}</div>}
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Welcome to your portal.</div>
          </div>
        </div>
      </div>
    );
  }

  // Edit mode
  if (isEditOpen) {
    return (
      <div className="client-hd-card">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={lbl}>Company Name {req}
            <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })}
              style={submitted && !valid.company ? errorInputStyle : inputStyle} />
          </label>
          <div />
          <label style={lbl}>First Name {req}
            <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              style={submitted && !valid.firstName ? errorInputStyle : inputStyle} />
          </label>
          <label style={lbl}>Last Name {req}
            <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              style={submitted && !valid.lastName ? errorInputStyle : inputStyle} />
          </label>
          <label style={lbl}>Title
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Owner" style={inputStyle} />
          </label>
          <label style={lbl}>Email {req}
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              style={submitted && !valid.email ? errorInputStyle : inputStyle} />
          </label>
          <label style={lbl}>Contact Phone
            <input type="tel" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} style={inputStyle} />
          </label>
          <label style={lbl}>Business Phone
            <input type="tel" value={form.businessPhone} onChange={(e) => setForm({ ...form, businessPhone: e.target.value })} style={inputStyle} />
          </label>
          <label style={lbl}>Address
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} style={inputStyle} />
          </label>
          <label style={lbl}>Website
            <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} style={inputStyle} />
          </label>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={handleSave} disabled={saving} className="cta-btn" style={{ fontSize: 12, height: 32, padding: '0 14px' }}>
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button onClick={() => { setIsEditOpen(false); setSubmitted(false); }} style={{
            padding: '0 14px', height: 32, fontSize: 12, fontWeight: 600,
            border: '1px solid #d1d5db', borderRadius: 8, background: '#fff',
            color: '#64748b', cursor: 'pointer', fontFamily: 'inherit',
          }}>Cancel</button>
        </div>
      </div>
    );
  }

  // Agency View — display mode
  const detailStyle: React.CSSProperties = { fontSize: 12, color: '#475569', marginTop: 2 };
  const labelStyle: React.CSSProperties = { color: '#94a3b8', fontWeight: 500 };

  return (
    <div className="client-hd-card">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        {clientLogo}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="client-hd-name">{client.company || client.name}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 20px', marginTop: 6 }}>
            {client.address && <div style={detailStyle}><span style={labelStyle}>Address:</span> {client.address}</div>}
            {client.website && <div style={detailStyle}><span style={labelStyle}>Website:</span> {client.website}</div>}
            {client.email && <div style={detailStyle}><span style={labelStyle}>Email:</span> {client.email}</div>}
            {client.phone && <div style={detailStyle}><span style={labelStyle}>Phone:</span> {client.phone}</div>}
          </div>
          {missing.length === 0 ? (
            <div style={{ fontSize: 11, color: '#00C9A0', marginTop: 6 }}>Profile complete</div>
          ) : (
            <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 6 }}>Missing: {missing.join(', ')}</div>
          )}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setIsEditOpen(true)} style={{ flexShrink: 0 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          Edit Client
        </button>
      </div>
      <ContactChips contacts={contacts} clientId={client.id} isClient={isClient} />
    </div>
  );
}
