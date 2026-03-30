'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveClient, saveContact, DB } from '@/lib/database';
import { Client } from '@/lib/types';

const inputStyle: React.CSSProperties = {
  display: 'block', width: '100%', marginTop: 4, padding: '8px 10px',
  fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 8,
  fontFamily: 'Inter, sans-serif', color: '#1a1f2e',
};
const errorInputStyle: React.CSSProperties = { ...inputStyle, borderColor: '#ef4444' };
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#334155', display: 'block' };
const req = <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>;
const errMsg = (msg: string) => <div style={{ fontSize: 11, color: '#ef4444', marginTop: 2 }}>{msg}</div>;

export default function NewClientPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    company: '', firstName: '', lastName: '', title: '',
    email: '', contactPhone: '', businessPhone: '',
    address: '', website: '', notes: '',
  });

  const update = (key: string, value: string) => setForm((p) => ({ ...p, [key]: value }));

  const valid = {
    company: form.company.trim().length > 0,
    firstName: form.firstName.trim().length > 0,
    lastName: form.lastName.trim().length > 0,
    email: form.email.trim().length > 0 && form.email.includes('@'),
  };
  const allValid = valid.company && valid.firstName && valid.lastName && valid.email;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!allValid) return;

    setSaving(true);
    try {
      const newClient: Client = {
        id: '', name: form.company, company: form.company,
        email: form.email, phone: form.contactPhone || form.businessPhone,
        website: form.website, address: form.address, city: '',
        logo: null, activeModules: ['invoices'],
        hasBrandKit: false, hasEmailSig: false,
        engagementStatus: 'active', nextStep: '',
        emailSignatureHtml: '', signatureFields: {},
        brandKit: {
          _id: null,
          logos: { light: [], dark: [], color: [], icon: [], secondary: [], favicon: [] },
          colors: [], fonts: { heading: '', body: '', accent: '' }, notes: '',
        },
      };

      const result = await saveClient(newClient);
      if (result?.id) {
        newClient.id = result.id;
        DB.clients.push(newClient);

        const contactName = `${form.firstName.trim()} ${form.lastName.trim()}`;
        const contact = await saveContact({
          clientId: result.id,
          name: contactName,
          role: form.title,
          email: form.email,
          phone: form.contactPhone,
          isPrimary: true,
        });
        if (contact) {
          DB.contacts[result.id] = [contact];
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
      <h1 style={{ fontSize: 28, fontWeight: 700, color: '#1a1f2e', marginBottom: 4 }}>Add Client</h1>
      <p style={{ fontSize: 14, color: '#94a3b8', marginBottom: 24 }}>Create a new client profile</p>

      <form onSubmit={handleSubmit} style={{
        background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
        padding: 24, maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <label style={labelStyle}>Company / Client Name {req}
          <input value={form.company} onChange={(e) => update('company', e.target.value)}
            style={submitted && !valid.company ? errorInputStyle : inputStyle} />
          {submitted && !valid.company && errMsg('Company name is required')}
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <label style={labelStyle}>First Name {req}
            <input value={form.firstName} onChange={(e) => update('firstName', e.target.value)}
              style={submitted && !valid.firstName ? errorInputStyle : inputStyle} />
            {submitted && !valid.firstName && errMsg('First name is required')}
          </label>
          <label style={labelStyle}>Last Name {req}
            <input value={form.lastName} onChange={(e) => update('lastName', e.target.value)}
              style={submitted && !valid.lastName ? errorInputStyle : inputStyle} />
            {submitted && !valid.lastName && errMsg('Last name is required')}
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <label style={labelStyle}>Title
            <input value={form.title} onChange={(e) => update('title', e.target.value)}
              placeholder="e.g. Owner, Founder" style={inputStyle} />
          </label>
          <label style={labelStyle}>Email {req}
            <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)}
              style={submitted && !valid.email ? errorInputStyle : inputStyle} />
            {submitted && !valid.email && errMsg('Valid email is required')}
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <label style={labelStyle}>Contact Phone
            <input type="tel" value={form.contactPhone} onChange={(e) => update('contactPhone', e.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>Business Phone
            <input type="tel" value={form.businessPhone} onChange={(e) => update('businessPhone', e.target.value)} style={inputStyle} />
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <label style={labelStyle}>Address
            <input value={form.address} onChange={(e) => update('address', e.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>Website
            <input value={form.website} placeholder="example.com" onChange={(e) => update('website', e.target.value)} style={inputStyle} />
          </label>
        </div>

        <label style={labelStyle}>Notes
          <textarea value={form.notes} rows={3} onChange={(e) => update('notes', e.target.value)}
            placeholder="Optional notes..." style={{ ...inputStyle, resize: 'vertical' }} />
        </label>

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button type="submit" disabled={saving} className="cta-btn">
            {saving ? 'Creating...' : 'Create Client'}
          </button>
          <button type="button" onClick={() => router.push('/')} style={{
            padding: '0 20px', height: 36, fontSize: 13, fontWeight: 600,
            border: '1.5px solid #d1d5db', borderRadius: 8,
            background: '#fff', color: '#64748b', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
          }}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
