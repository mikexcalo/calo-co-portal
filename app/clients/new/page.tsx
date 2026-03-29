'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveClient, saveContact, DB } from '@/lib/database';
import { Client } from '@/lib/types';

const INDUSTRIES = [
  'Flooring', 'Construction', 'Landscaping', 'General Contractor',
  'Plumbing', 'Electrical', 'Painting', 'Roofing', 'HVAC',
  'Cleaning Services', 'Other',
];

const inputStyle: React.CSSProperties = {
  display: 'block', width: '100%', marginTop: 4, padding: '8px 10px',
  fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 8,
  fontFamily: 'Inter, sans-serif', color: '#1a1f2e',
};

const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: '#334155', display: 'block',
};

export default function NewClientPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    company: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    address: '',
    industry: '',
    website: '',
    notes: '',
  });

  const update = (key: string, value: string) => setForm((p) => ({ ...p, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company.trim()) return;

    setSaving(true);
    try {
      const newClient: Client = {
        id: '',
        name: form.company,
        company: form.company,
        email: form.contactEmail,
        phone: form.contactPhone,
        website: form.website,
        address: form.address,
        city: '',
        logo: null,
        activeModules: ['invoices'],
        hasBrandKit: false,
        hasEmailSig: false,
        engagementStatus: 'active',
        nextStep: '',
        emailSignatureHtml: '',
        signatureFields: {},
        brandKit: {
          _id: null,
          logos: { light: [], dark: [], color: [], icon: [], secondary: [], favicon: [] },
          colors: [],
          fonts: { heading: '', body: '', accent: '' },
          notes: '',
        },
      };

      const result = await saveClient(newClient);
      if (result?.id) {
        newClient.id = result.id;
        DB.clients.push(newClient);

        // Create primary contact if name provided
        if (form.contactName.trim()) {
          const contact = await saveContact({
            clientId: result.id,
            name: form.contactName,
            role: '',
            email: form.contactEmail,
            phone: form.contactPhone,
            isPrimary: true,
          });
          if (contact) {
            DB.contacts[result.id] = [contact];
          }
        }

        router.push(`/clients/${result.id}`);
      }
    } catch (err) {
      console.error('Failed to create client:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <h1 style={{ fontSize: 28, fontWeight: 700, color: '#1a1f2e', marginBottom: 4 }}>
        Add Client
      </h1>
      <p style={{ fontSize: 14, color: '#94a3b8', marginBottom: 24 }}>
        Create a new client profile
      </p>

      <form onSubmit={handleSubmit} style={{
        background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
        padding: 24, maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        {/* Company name — full width */}
        <label style={labelStyle}>
          Company / Client Name *
          <input type="text" required value={form.company}
            onChange={(e) => update('company', e.target.value)} style={inputStyle} />
        </label>

        {/* Two-column row: contact name + email */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <label style={labelStyle}>
            Primary Contact Name
            <input type="text" value={form.contactName}
              onChange={(e) => update('contactName', e.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Primary Contact Email
            <input type="email" value={form.contactEmail}
              onChange={(e) => update('contactEmail', e.target.value)} style={inputStyle} />
          </label>
        </div>

        {/* Two-column row: phone + address */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <label style={labelStyle}>
            Primary Contact Phone
            <input type="tel" value={form.contactPhone}
              onChange={(e) => update('contactPhone', e.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Address
            <input type="text" value={form.address}
              onChange={(e) => update('address', e.target.value)} style={inputStyle} />
          </label>
        </div>

        {/* Two-column row: industry + website */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <label style={labelStyle}>
            Industry / Trade Type
            <select value={form.industry} onChange={(e) => update('industry', e.target.value)}
              style={{ ...inputStyle, background: '#fff' }}>
              <option value="">Select...</option>
              {INDUSTRIES.map((ind) => <option key={ind} value={ind}>{ind}</option>)}
            </select>
          </label>
          <label style={labelStyle}>
            Website
            <input type="text" value={form.website} placeholder="example.com"
              onChange={(e) => update('website', e.target.value)} style={inputStyle} />
          </label>
        </div>

        {/* Notes */}
        <label style={labelStyle}>
          Notes
          <textarea value={form.notes} rows={3}
            onChange={(e) => update('notes', e.target.value)}
            placeholder="Optional notes about this client..."
            style={{ ...inputStyle, resize: 'vertical' }} />
        </label>

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button type="submit" disabled={saving} className="cta-btn">
            {saving ? 'Creating...' : 'Create Client'}
          </button>
          <button type="button" onClick={() => router.push('/')}
            style={{
              padding: '0 20px', height: 36, fontSize: 13, fontWeight: 600,
              border: '1.5px solid #d1d5db', borderRadius: 8,
              background: '#fff', color: '#64748b', cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
