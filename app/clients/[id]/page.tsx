'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Client, Contact, Invoice } from '@/lib/types';
import { DB, loadClients, loadContacts, loadInvoices, loadAllBrandKits, saveClient, saveContact } from '@/lib/database';
import { clientStats, currency, invTotal } from '@/lib/utils';
import ClientUpdates from '@/components/client-hub/ClientUpdates';
import { PageLayout, Section, CardGrid, Card, InfoBar, SectionLabel } from '@/components/shared/PageLayout';

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
  const [form, setForm] = useState({
    company: '', firstName: '', lastName: '', title: '',
    email: '', contactPhone: '', businessPhone: '', address: '', website: '',
  });

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

  // Populate edit form when client/contacts data is available
  useEffect(() => {
    if (!client) return;
    const p = contacts.find((c) => c.isPrimary) || contacts[0];
    const parts = (p?.name || '').split(/\s+/);
    setForm({
      company: client.company || client.name || '',
      firstName: parts[0] || '',
      lastName: parts.slice(1).join(' ') || '',
      title: p?.title || p?.role || '',
      email: p?.email || client.email || '',
      contactPhone: p?.phone || '',
      businessPhone: client.phone || '',
      address: client.address || '',
      website: client.website || '',
    });
  }, [client, contacts]);

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
  const nameParts = (primary?.name || '').split(/\s+/);

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
    <PageLayout>
      {/* Client info bar */}
      <InfoBar>
        {client.logo ? (
          <img src={client.logo} alt="" style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
        ) : (
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f1f3f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#475569', flexShrink: 0 }}>
            {(client.company || client.name).charAt(0).toUpperCase()}
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#111827' }}>{client.company || client.name}</div>
          {missing.length === 0 ? (
            <span style={{ fontSize: 13, color: '#16a34a' }}>Profile complete</span>
          ) : (
            <span style={{ fontSize: 13, color: '#f59e0b' }}>Missing: {missing.join(', ')}</span>
          )}
        </div>
        {!isClient && (
          <button onClick={() => setIsEditOpen(true)} style={{
            background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
            padding: '6px 14px', fontSize: 13, fontWeight: 500, color: '#374151',
            cursor: 'pointer', fontFamily: 'Inter, sans-serif',
          }}>Edit Client</button>
        )}
      </InfoBar>

      {/* Contacts section */}
      <Section label="Contacts">
        <CardGrid columns={3}>
          {contacts.map((c) => (
            <Card key={c.id || c.name}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', background: '#f1f3f5',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 600, color: '#475569', flexShrink: 0,
                }}>
                  {(c.name || '?').charAt(0).toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{c.name}</div>
                  {(c.title || c.role) && <div style={{ fontSize: 12, color: '#9ca3af' }}>{c.title || c.role}</div>}
                </div>
              </div>
              {(c.email || c.phone) && (
                <div style={{ marginTop: 8, fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>
                  {c.email && <div>{c.email}</div>}
                  {c.phone && <div>{c.phone}</div>}
                </div>
              )}
            </Card>
          ))}
        </CardGrid>
      </Section>

      {/* Two-column: Tasks + Quick links */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
        {/* Tasks & Notes */}
        <div>
          <ClientUpdates clientId={clientId} isClient={isClient} />
        </div>

        {/* Quick links */}
        <div>
          <Section label="Quick links">
            <CardGrid columns={2}>
              <Card onClick={() => router.push(`/clients/${clientId}/brand-builder`)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.3" style={{ marginBottom: 6 }}><rect x="1.5" y="1.5" width="21" height="21" rx="2"/><line x1="1.5" y1="8" x2="22.5" y2="8"/><line x1="8" y1="8" x2="8" y2="22.5"/></svg>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Design Studio</div>
                <div style={{ fontSize: 13, color: '#9ca3af' }}>Create print + digital assets</div>
              </Card>
              <Card onClick={() => router.push(`/clients/${clientId}/brand-kit${isClient ? '?viewMode=view' : ''}`)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.3" style={{ marginBottom: 6 }}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1.2"/></svg>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Brand Kit</div>
                <div style={{ fontSize: 13, color: '#9ca3af' }}>{bkMeta}</div>
              </Card>
              <Card onClick={() => router.push(`/clients/${clientId}/invoices`)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.3" style={{ marginBottom: 6 }}><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 7h8M8 11h8M8 15h4" strokeLinecap="round"/></svg>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Invoices</div>
                <div style={{ fontSize: 13, color: '#9ca3af' }}>{invMeta}</div>
              </Card>
              {!isClient && (
                <Card onClick={() => router.push(`/clients/${clientId}/financials`)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.3" style={{ marginBottom: 6 }}><rect x="2" y="2" width="20" height="20" rx="2"/><line x1="7" y1="17" x2="7" y2="12" strokeLinecap="round"/><line x1="12" y1="17" x2="12" y2="8" strokeLinecap="round"/><line x1="17" y1="17" x2="17" y2="13" strokeLinecap="round"/></svg>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Financials</div>
                  <div style={{ fontSize: 13, color: '#9ca3af' }}>{finMeta}</div>
                </Card>
              )}
            </CardGrid>
          </Section>
        </div>
      </div>
    </PageLayout>
  );
}
