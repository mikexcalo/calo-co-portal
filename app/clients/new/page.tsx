'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveClient, DB } from '@/lib/database';
import { Client } from '@/lib/types';

export default function NewClientPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    company: '',
    email: '',
    phone: '',
    website: '',
    address: '',
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
        email: form.email,
        phone: form.phone,
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
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
        Add Client
      </h1>
      <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 24 }}>
        Create a new client profile
      </p>

      <form onSubmit={handleSubmit} style={{
        background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
        padding: 24, maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>
          Company / Client Name *
          <input
            type="text" required value={form.company}
            onChange={(e) => update('company', e.target.value)}
            style={{
              display: 'block', width: '100%', marginTop: 4, padding: '10px 12px',
              fontSize: 14, border: '1px solid #e2e8f0', borderRadius: 8,
              fontFamily: 'Inter, sans-serif',
            }}
          />
        </label>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>
          Email
          <input
            type="email" value={form.email}
            onChange={(e) => update('email', e.target.value)}
            style={{
              display: 'block', width: '100%', marginTop: 4, padding: '10px 12px',
              fontSize: 14, border: '1px solid #e2e8f0', borderRadius: 8,
              fontFamily: 'Inter, sans-serif',
            }}
          />
        </label>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>
          Phone
          <input
            type="tel" value={form.phone}
            onChange={(e) => update('phone', e.target.value)}
            style={{
              display: 'block', width: '100%', marginTop: 4, padding: '10px 12px',
              fontSize: 14, border: '1px solid #e2e8f0', borderRadius: 8,
              fontFamily: 'Inter, sans-serif',
            }}
          />
        </label>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>
          Website
          <input
            type="text" value={form.website}
            onChange={(e) => update('website', e.target.value)}
            placeholder="example.com"
            style={{
              display: 'block', width: '100%', marginTop: 4, padding: '10px 12px',
              fontSize: 14, border: '1px solid #e2e8f0', borderRadius: 8,
              fontFamily: 'Inter, sans-serif',
            }}
          />
        </label>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>
          Address
          <input
            type="text" value={form.address}
            onChange={(e) => update('address', e.target.value)}
            style={{
              display: 'block', width: '100%', marginTop: 4, padding: '10px 12px',
              fontSize: 14, border: '1px solid #e2e8f0', borderRadius: 8,
              fontFamily: 'Inter, sans-serif',
            }}
          />
        </label>

        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button type="submit" disabled={saving} className="cta-btn">
            {saving ? 'Creating...' : 'Create Client'}
          </button>
          <button type="button" onClick={() => router.push('/')}
            style={{
              padding: '10px 20px', fontSize: 14, fontWeight: 600,
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
