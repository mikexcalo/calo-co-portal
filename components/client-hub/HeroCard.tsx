'use client';

import { useState } from 'react';
import { Client, Contact } from '@/lib/types';
import { saveClient } from '@/lib/database';
import ContactChips from './ContactChips';

const INDUSTRIES = [
  'Flooring', 'Construction', 'Landscaping', 'General Contractor',
  'Plumbing', 'Electrical', 'Painting', 'Roofing', 'HVAC',
  'Cleaning Services', 'Other',
];

interface HeroCardProps {
  client: Client;
  contacts: Contact[];
  isClient: boolean;
  onClientUpdate: (client: Client) => void;
}

export default function HeroCard({ client, contacts, isClient, onClientUpdate }: HeroCardProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    company: client.company || client.name || '',
    email: client.email || '',
    phone: client.phone || '',
    website: client.website || '',
    address: client.address || '',
    industry: (client as any).industry || '',
    notes: (client as any).notes || '',
  });

  const primary = contacts.find((c) => c.isPrimary) || contacts[0];

  // Profile completeness
  const missing: string[] = [];
  if (!client.website) missing.push('website');
  if (!(client as any).industry) missing.push('industry');
  if (!primary?.email) missing.push('contact email');
  if (!primary?.phone) missing.push('contact phone');

  const handleSave = async () => {
    setSaving(true);
    const updated = {
      ...client,
      company: form.company,
      name: form.company,
      email: form.email,
      phone: form.phone,
      website: form.website,
      address: form.address,
    };
    await saveClient(updated);
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

  // Client View — clean, simple
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
    const inputStyle: React.CSSProperties = {
      width: '100%', padding: '7px 10px', fontSize: 13,
      border: '1px solid #e2e8f0', borderRadius: 8, fontFamily: 'Inter, sans-serif',
    };
    return (
      <div className="client-hd-card">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#334155' }}>
            Company Name
            <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} style={inputStyle} />
          </label>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#334155' }}>
            Email
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={inputStyle} />
          </label>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#334155' }}>
            Phone
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={inputStyle} />
          </label>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#334155' }}>
            Website
            <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} style={inputStyle} />
          </label>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#334155' }}>
            Address
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} style={inputStyle} />
          </label>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#334155' }}>
            Industry
            <select value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} style={{ ...inputStyle, background: '#fff' }}>
              <option value="">Select...</option>
              {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </label>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={handleSave} disabled={saving} className="cta-btn" style={{ fontSize: 12, height: 32, padding: '0 14px' }}>
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button onClick={() => setIsEditOpen(false)} style={{
            padding: '0 14px', height: 32, fontSize: 12, fontWeight: 600,
            border: '1px solid #d1d5db', borderRadius: 8, background: '#fff',
            color: '#64748b', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
          }}>Cancel</button>
        </div>
      </div>
    );
  }

  // Agency View — labeled fields
  const detailStyle: React.CSSProperties = { fontSize: 12, color: '#475569', marginTop: 2 };
  const labelStyle: React.CSSProperties = { color: '#94a3b8', fontWeight: 500 };

  return (
    <div className="client-hd-card">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        {clientLogo}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="client-hd-name">{client.company || client.name}</div>
          {/* Labeled fields */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 20px', marginTop: 6 }}>
            {client.address && <div style={detailStyle}><span style={labelStyle}>Address:</span> {client.address}</div>}
            {client.website && <div style={detailStyle}><span style={labelStyle}>Website:</span> {client.website}</div>}
            {client.email && <div style={detailStyle}><span style={labelStyle}>Email:</span> {client.email}</div>}
            {client.phone && <div style={detailStyle}><span style={labelStyle}>Phone:</span> {client.phone}</div>}
          </div>
          {/* Profile completeness */}
          {missing.length === 0 ? (
            <div style={{ fontSize: 11, color: '#22c55e', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>Profile complete</span>
            </div>
          ) : (
            <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 6 }}>
              Missing: {missing.join(', ')}
            </div>
          )}
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setIsEditOpen(true)}
          style={{ flexShrink: 0 }}
        >
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
