'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Client, Contact, Invoice } from '@/lib/types';
import { DB, loadClients, loadContacts, loadInvoices, loadAllBrandKits, saveClient, saveContact } from '@/lib/database';
import { clientStats, currency, invTotal } from '@/lib/utils';
import ClientUpdates from '@/components/client-hub/ClientUpdates';

export default function ClientHubPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Listen for view mode changes from the nav toggle
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('viewMode') : null;
    setIsClient(stored === 'client');

    const handler = (e: Event) => {
      const mode = (e as CustomEvent).detail;
      setIsClient(mode === 'client');
    };
    window.addEventListener('viewModeChange', handler);
    return () => window.removeEventListener('viewModeChange', handler);
  }, []);

  useEffect(() => {
    const initData = async () => {
      setIsLoading(true);

      if (DB.clientsState !== 'loaded') await loadClients();
      if (!DB.contacts[clientId]) await loadContacts(clientId);

      // Only reload invoices if not already cached for this client
      const hasInvoices = DB.invoices.some((i) => i.clientId === clientId);
      if (!hasInvoices) await loadInvoices(clientId);

      // Brand kits: skip if any client already has brand kit data loaded
      const hasBk = DB.clients.some((c) => c.brandKit?._id);
      if (!hasBk) await loadAllBrandKits();

      const foundClient = DB.clients.find((c) => c.id === clientId);
      if (foundClient) {
        setClient(foundClient);
        setContacts(DB.contacts[clientId] || []);
        setInvoices(DB.invoices.filter((i) => i.clientId === clientId));
      } else {
        router.push('/');
      }

      setIsLoading(false);
    };

    initData();
  }, [clientId, router]);

  if (isLoading) {
    return (
      <div style={{ padding: '24px 32px', color: '#94a3b8', fontSize: 13 }}>
        Loading client data...
      </div>
    );
  }

  if (!client) {
    return (
      <div style={{ padding: '24px 32px', color: '#ef4444', fontSize: 13 }}>
        Client not found.
      </div>
    );
  }

  const primary = contacts.find((c) => c.isPrimary) || contacts[0];
  const stats = clientStats(invoices, clientId);

  // --- Edit form state ---
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
  });

  const valid = {
    company: form.company.trim().length > 0,
    firstName: form.firstName.trim().length > 0,
    lastName: form.lastName.trim().length > 0,
    email: form.email.trim().length > 0 && form.email.includes('@'),
  };

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
    const contactName = `${form.firstName.trim()} ${form.lastName.trim()}`;
    if (primary?.id) {
      await saveContact({ id: primary.id, clientId: client.id, name: contactName, role: form.title, email: form.email, phone: form.contactPhone, isPrimary: true });
    } else {
      const nc = await saveContact({ clientId: client.id, name: contactName, role: form.title, email: form.email, phone: form.contactPhone, isPrimary: true });
      if (nc) DB.contacts[client.id] = [nc];
    }
    setClient(updated);
    setIsEditOpen(false);
    setSaving(false);
  };

  // --- Profile completeness ---
  const missing: string[] = [];
  if (!primary?.name || !primary.name.includes(' ')) {
    if (!nameParts[0]) missing.push('First Name');
    if (!nameParts[1]) missing.push('Last Name');
  }
  if (!primary?.email && !client.email) missing.push('Email');
  const bk = client.brandKit;
  const hasLogos = bk && Object.values(bk.logos || {}).some((a: any) => a?.length > 0);
  if (!hasLogos) missing.push('Brand Kit logos');
  if (!bk?.colors?.length) missing.push('Brand colors');

  // --- Module metadata ---
  const logoSlots = client.brandKit?.logos || {};
  const logoCount = (['color', 'light', 'dark', 'icon', 'secondary', 'favicon'] as const).filter(
    (slot) => (logoSlots[slot] || []).length > 0
  ).length;
  const bkColors = client.brandKit?.colors?.length || 0;
  const hasBkFonts = !!(client.brandKit?.fonts?.heading || client.brandKit?.fonts?.body || client.brandKit?.fonts?.accent);
  let bkBits: string[] = [];
  if (logoCount > 0) bkBits.push(`${logoCount} logos`);
  if (bkColors > 0) bkBits.push(`${bkColors} colors`);
  if (hasBkFonts) bkBits.push('Fonts');
  const bkMeta = bkBits.length > 0 ? bkBits.join(' · ') : 'Not started';

  const sigFields = client.signatureFields || {};
  const sigContacts = DB.contacts[clientId] || [];
  const sigPrimary = sigContacts.find((c) => c.isPrimary) || sigContacts[0];
  const sigHasData = !!client.emailSignatureHtml || !!sigFields.name || !!sigFields.email || !!sigFields.company || !!(sigFields as any).logoSrc || (sigPrimary && (sigPrimary.name || sigPrimary.email));
  const sigMeta = sigHasData ? (sigFields.name || sigPrimary?.name || 'Configured') : 'Not started';

  const invCount = invoices.length;
  const invMeta = invCount === 0 ? 'No invoices' : `${invCount} inv · ${currency(stats.outstanding)} due`;

  const finScopeRev = invoices.filter((i) => !i.isReimbursement).reduce((s, i) => s + invTotal(i), 0);
  const finScopeExp = (DB.expenses || []).filter((e) => e.clientId === clientId).reduce((s, e) => s + e.amount, 0);
  const finMeta = finScopeRev > 0 ? `${currency(finScopeRev)} rev` : 'Revenue · P&L';

  // --- Shared styles ---
  const metricLbl: React.CSSProperties = { fontSize: '10px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.3px', margin: '0 0 2px' };
  const sectionLbl: React.CSSProperties = { fontSize: '10px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px' };
  const inputStyle: React.CSSProperties = { width: '100%', padding: '7px 10px', fontSize: 13, marginTop: 4, border: '1px solid #e2e8f0', borderRadius: 8, fontFamily: 'Inter, sans-serif' };
  const errorInputStyle: React.CSSProperties = { ...inputStyle, borderColor: '#ef4444' };
  const editLbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#334155', display: 'block' };
  const req = <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>;

  // --- Edit mode ---
  if (isEditOpen) {
    return (
      <div style={{ padding: '24px 32px', maxWidth: '960px' }}>
        <div style={{ background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 8, padding: '16px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={editLbl}>Company Name {req}
              <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} style={submitted && !valid.company ? errorInputStyle : inputStyle} />
            </label>
            <div />
            <label style={editLbl}>First Name {req}
              <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} style={submitted && !valid.firstName ? errorInputStyle : inputStyle} />
            </label>
            <label style={editLbl}>Last Name {req}
              <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} style={submitted && !valid.lastName ? errorInputStyle : inputStyle} />
            </label>
            <label style={editLbl}>Title
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Owner" style={inputStyle} />
            </label>
            <label style={editLbl}>Email {req}
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={submitted && !valid.email ? errorInputStyle : inputStyle} />
            </label>
            <label style={editLbl}>Contact Phone
              <input type="tel" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} style={inputStyle} />
            </label>
            <label style={editLbl}>Business Phone
              <input type="tel" value={form.businessPhone} onChange={(e) => setForm({ ...form, businessPhone: e.target.value })} style={inputStyle} />
            </label>
            <label style={editLbl}>Address
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} style={inputStyle} />
            </label>
            <label style={editLbl}>Website
              <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} style={inputStyle} />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={handleSave} disabled={saving} style={{ height: 32, fontSize: 12, fontWeight: 500, padding: '0 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={() => { setIsEditOpen(false); setSubmitted(false); }} style={{ padding: '0 14px', height: 32, fontSize: 12, fontWeight: 600, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#64748b', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: '960px' }}>

      {/* SECTION 1: Profile card */}
      <div style={{ background: '#ffffff', border: '0.5px solid #e5e7eb', borderRadius: 8, padding: '16px 20px', marginBottom: 24 }}>
        {/* Top row: logo + name + edit */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {client.logo ? (
              <img src={client.logo} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <div style={{ width: 40, height: 40, borderRadius: 8, background: '#f1f3f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#475569', flexShrink: 0 }}>
                {(client.company || client.name).charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p style={{ fontSize: 16, fontWeight: 500, margin: 0, color: '#111827' }}>{client.company || client.name}</p>
              {missing.length === 0 ? (
                <span style={{ fontSize: 11, color: '#16a34a' }}>Profile complete</span>
              ) : (
                <span style={{ fontSize: 11, color: '#f59e0b' }}>Missing: {missing.join(', ')}</span>
              )}
            </div>
          </div>
          {!isClient && (
            <span style={{ fontSize: 11, color: '#2563eb', cursor: 'pointer', fontWeight: 500 }} onClick={() => setIsEditOpen(true)}>Edit</span>
          )}
        </div>

        {/* Contact fields — 5-column grid with vertical dividers */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 0, borderTop: '0.5px solid #e5e7eb', paddingTop: 12 }}>
          <div style={{ paddingRight: 16 }}>
            <p style={metricLbl}>Contact</p>
            <p style={{ fontSize: 12, fontWeight: 500, color: '#111827', margin: 0 }}>{primary?.name || '—'}</p>
            <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0' }}>{primary?.title || primary?.role || ''}</p>
          </div>
          <div style={{ padding: '0 16px', borderLeft: '0.5px solid #e5e7eb' }}>
            <p style={metricLbl}>Business phone</p>
            <p style={{ fontSize: 12, color: '#111827', margin: 0 }}>{client.phone || '—'}</p>
          </div>
          <div style={{ padding: '0 16px', borderLeft: '0.5px solid #e5e7eb' }}>
            <p style={metricLbl}>Mobile</p>
            <p style={{ fontSize: 12, color: '#111827', margin: 0 }}>{primary?.phone || '—'}</p>
          </div>
          <div style={{ padding: '0 16px', borderLeft: '0.5px solid #e5e7eb' }}>
            <p style={metricLbl}>Email</p>
            <p style={{ fontSize: 12, color: '#111827', margin: 0 }}>{primary?.email || client.email || '—'}</p>
          </div>
          <div style={{ paddingLeft: 16, borderLeft: '0.5px solid #e5e7eb' }}>
            <p style={metricLbl}>Address</p>
            <p style={{ fontSize: 12, color: '#111827', margin: 0 }}>{client.address || '—'}</p>
          </div>
        </div>
      </div>

      {/* SECTION 2: Two-column — Tasks left, Modules right */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}>

        {/* Left column — Tasks & Notes */}
        <div>
          <ClientUpdates clientId={clientId} isClient={isClient} />
        </div>

        {/* Right column — Modules */}
        <div>
          <p style={sectionLbl}>Modules</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>

            {/* Invoices */}
            <div onClick={() => router.push(`/clients/${clientId}/invoices`)} style={{ background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 8, padding: 14, cursor: 'pointer', textAlign: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ margin: '0 auto 6px', display: 'block' }}><rect x="4" y="2" width="16" height="20" rx="2" stroke="#6b7280" strokeWidth="1.3"/><path d="M8 7h8M8 11h8M8 15h4" stroke="#6b7280" strokeWidth="1.2" strokeLinecap="round"/></svg>
              <p style={{ fontSize: 11, fontWeight: 500, color: '#111827', margin: '0 0 2px' }}>Invoices</p>
              <p style={{ fontSize: 9, color: '#9ca3af', margin: 0 }}>{invMeta}</p>
            </div>

            {/* Financials — agency only */}
            {!isClient && (
              <div onClick={() => router.push(`/clients/${clientId}/financials`)} style={{ background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 8, padding: 14, cursor: 'pointer', textAlign: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ margin: '0 auto 6px', display: 'block' }}><circle cx="12" cy="12" r="9" stroke="#6b7280" strokeWidth="1.3"/><path d="M12 6v12M9 9.5c0-1.1 1.3-2 3-2s3 .9 3 2-1.3 2-3 2-3 .9-3 2 1.3 2 3 2 3-.9 3-2" stroke="#6b7280" strokeWidth="1.2" strokeLinecap="round"/></svg>
                <p style={{ fontSize: 11, fontWeight: 500, color: '#111827', margin: '0 0 2px' }}>Financials</p>
                <p style={{ fontSize: 9, color: '#9ca3af', margin: 0 }}>{finMeta}</p>
              </div>
            )}

            {/* Brand Kit */}
            <div onClick={() => router.push(`/clients/${clientId}/brand-kit${isClient ? '?viewMode=view' : ''}`)} style={{ background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 8, padding: 14, cursor: 'pointer', textAlign: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ margin: '0 auto 6px', display: 'block' }}><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="#6b7280" strokeWidth="1.3"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="#6b7280" strokeWidth="1.3"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="#6b7280" strokeWidth="1.3"/><circle cx="17.5" cy="17.5" r="3.5" stroke="#6b7280" strokeWidth="1.3"/></svg>
              <p style={{ fontSize: 11, fontWeight: 500, color: '#111827', margin: '0 0 2px' }}>Brand Kit</p>
              <p style={{ fontSize: 9, color: '#9ca3af', margin: 0 }}>{bkMeta}</p>
            </div>

            {/* Email Signature */}
            <div onClick={() => router.push(`/clients/${clientId}/email-signature`)} style={{ background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 8, padding: 14, cursor: 'pointer', textAlign: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ margin: '0 auto 6px', display: 'block' }}><rect x="3" y="5" width="18" height="14" rx="2" stroke="#6b7280" strokeWidth="1.3"/><path d="M3 7l9 6 9-6" stroke="#6b7280" strokeWidth="1.3"/></svg>
              <p style={{ fontSize: 11, fontWeight: 500, color: '#111827', margin: '0 0 2px' }}>Email Signature</p>
              <p style={{ fontSize: 9, color: '#9ca3af', margin: 0 }}>{sigMeta}</p>
            </div>

            {/* Design Studio */}
            <div onClick={() => router.push(`/clients/${clientId}/brand-builder`)} style={{ background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 8, padding: 14, cursor: 'pointer', textAlign: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ margin: '0 auto 6px', display: 'block' }}><path d="M12 2L2 7l10 5 10-5-10-5z" stroke="#6b7280" strokeWidth="1.3" strokeLinejoin="round"/><path d="M2 17l10 5 10-5" stroke="#6b7280" strokeWidth="1.3" strokeLinejoin="round"/><path d="M2 12l10 5 10-5" stroke="#6b7280" strokeWidth="1.3" strokeLinejoin="round"/></svg>
              <p style={{ fontSize: 11, fontWeight: 500, color: '#111827', margin: '0 0 2px' }}>Design Studio</p>
              <p style={{ fontSize: 9, color: '#9ca3af', margin: 0 }}>Get started</p>
            </div>

            {/* Content Suite — locked add-on */}
            <div onClick={() => alert('Want access to Content Suite?\nAsk us about adding this to your package.')} style={{ background: '#fff', border: '0.5px dashed #d1d5db', borderRadius: 8, padding: 14, cursor: 'pointer', textAlign: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ margin: '0 auto 6px', display: 'block' }}><rect x="5" y="11" width="14" height="10" rx="2" stroke="#9ca3af" strokeWidth="1.3"/><path d="M8 11V7a4 4 0 018 0v4" stroke="#9ca3af" strokeWidth="1.3" strokeLinecap="round"/></svg>
              <p style={{ fontSize: 11, fontWeight: 500, color: '#9ca3af', margin: '0 0 2px' }}>Content Suite</p>
              <p style={{ fontSize: 9, color: '#2563eb', margin: 0 }}>Unlock →</p>
            </div>

          </div>

          {/* Manage access link */}
          {!isClient && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 10, borderTop: '0.5px solid #e5e7eb', marginTop: 12 }}>
              <span style={{ fontSize: 11, color: '#9ca3af', cursor: 'pointer' }} onClick={() => router.push(`/clients/${clientId}/access`)}>Manage access →</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
