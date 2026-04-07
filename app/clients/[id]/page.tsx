'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Client, Contact, Invoice } from '@/lib/types';
import { DB, loadClients, loadContacts, loadInvoices, loadAllBrandKits, saveClient, saveContact } from '@/lib/database';
import { clientStats, currency, invTotal, formatPhone } from '@/lib/utils';
import ClientUpdates from '@/components/client-hub/ClientUpdates';
import { PageLayout, Section, CardGrid, Card, InfoBar, SectionLabel } from '@/components/shared/PageLayout';
import { useTheme } from '@/lib/theme';
import HelmSpinner from '@/components/shared/HelmSpinner';

export default function ClientHubPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const { t } = useTheme();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [contactsOpen, setContactsOpen] = useState(false);
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

  if (isLoading) return null;

  if (!client) {
    return (
      <div style={{ padding: 32, fontSize: 13, color: t.status.danger }}>
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
    const contactData = { clientId: client.id, name: contactName, role: form.title, email: form.email, phone: form.contactPhone, isPrimary: true };
    if (primary?.id) {
      await saveContact({ id: primary.id, ...contactData });
      // Update contact in DB cache
      const cIdx = (DB.contacts[client.id] || []).findIndex((c) => c.id === primary.id);
      if (cIdx >= 0) DB.contacts[client.id][cIdx] = { ...DB.contacts[client.id][cIdx], ...contactData };
    } else {
      const nc = await saveContact(contactData);
      if (nc) DB.contacts[client.id] = [nc];
    }
    // Update local DB cache so data persists across navigation
    const idx = DB.clients.findIndex((c) => c.id === client.id);
    if (idx >= 0) DB.clients[idx] = updated;
    setClient(updated);
    // Refresh contacts in local state
    const freshContacts = DB.contacts[client.id] || [];
    setContacts([...freshContacts]);
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
  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 14px', fontSize: 14, marginTop: 4, border: `1px solid ${t.border.default}`, borderRadius: 8, fontFamily: 'inherit', background: t.bg.primary, color: t.text.primary, outline: 'none' };
  const errorInputStyle: React.CSSProperties = { ...inputStyle, borderColor: t.status.danger };
  const editLbl: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: t.text.secondary, display: 'block' };
  const req = <span style={{ color: t.status.danger, marginLeft: 2 }}>*</span>;

  // --- Edit mode ---
  if (isEditOpen) {
    return (
      <div style={{ padding: 32, maxWidth: 960 }}>
        <div style={{ background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 12, padding: '20px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={editLbl}>Company Name {req}<input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} style={submitted && !valid.company ? errorInputStyle : inputStyle} /></label>
            <div />
            <label style={editLbl}>First Name {req}<input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} style={submitted && !valid.firstName ? errorInputStyle : inputStyle} /></label>
            <label style={editLbl}>Last Name {req}<input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} style={submitted && !valid.lastName ? errorInputStyle : inputStyle} /></label>
            <label style={editLbl}>Title<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Owner" style={inputStyle} /></label>
            <label style={editLbl}>Email {req}<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={submitted && !valid.email ? errorInputStyle : inputStyle} /></label>
            <label style={editLbl}>Contact Phone<input type="tel" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} onBlur={() => setForm((f) => ({ ...f, contactPhone: formatPhone(f.contactPhone) }))} style={inputStyle} /></label>
            <label style={editLbl}>Business Phone<input type="tel" value={form.businessPhone} onChange={(e) => setForm({ ...form, businessPhone: e.target.value })} onBlur={() => setForm((f) => ({ ...f, businessPhone: formatPhone(f.businessPhone) }))} style={inputStyle} /></label>
            <label style={editLbl}>Address<input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} style={inputStyle} /></label>
            <label style={editLbl}>Website<input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} style={inputStyle} /></label>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button onClick={handleSave} disabled={saving} style={{ height: 32, fontSize: 13, fontWeight: 500, padding: '0 16px', background: t.accent.primary, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={() => { setIsEditOpen(false); setSubmitted(false); }} style={{ padding: '0 16px', height: 32, fontSize: 13, fontWeight: 500, border: `1px solid ${t.border.default}`, borderRadius: 8, background: t.bg.surface, color: t.text.secondary, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <PageLayout>
      {/* Client info bar with contacts dropdown */}
      <InfoBar>
        {client.logo ? (
          <img src={client.logo} alt="" style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
        ) : (
          <div style={{ width: 40, height: 40, borderRadius: 10, background: t.bg.surfaceHover, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: t.text.secondary, flexShrink: 0 }}>
            {(client.company || client.name).charAt(0).toUpperCase()}
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: t.text.primary }}>{client.company || client.name}</div>
          {missing.length === 0 ? (
            <span style={{ fontSize: 13, color: t.status.success }}>Profile complete</span>
          ) : (
            <span style={{ fontSize: 13, color: t.status.warning }}>Missing: {missing.join(', ')}</span>
          )}
        </div>
        <div style={{ position: 'relative' }}>
          <button onClick={() => setContactsOpen(!contactsOpen)} style={{
            background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 8,
            padding: '6px 14px', fontSize: 13, fontWeight: 500, color: t.text.secondary,
            cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4,
          }}>
            Contacts
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              style={{ transform: contactsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          {contactsOpen && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setContactsOpen(false)} />
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 6, zIndex: 11,
                background: t.bg.elevated, border: `1px solid ${t.border.default}`, borderRadius: 12,
                boxShadow: t.shadow.elevated, maxWidth: 320, minWidth: 260, padding: 12,
              }}>
                {contacts.map((c, i) => (
                  <div key={c.id || c.name} style={{ padding: '8px 0', borderBottom: i < contacts.length - 1 ? `0.5px solid ${t.border.default}` : 'none' }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: t.text.primary }}>{c.name}</div>
                    {(c.title || c.role) && <div style={{ fontSize: 12, color: t.text.tertiary }}>{c.title || c.role}</div>}
                    {c.email && <div style={{ fontSize: 12, color: t.text.secondary, marginTop: 2 }}>{c.email}</div>}
                    {c.phone && <div style={{ fontSize: 12, color: t.text.secondary }}>{c.phone}</div>}
                  </div>
                ))}
                {contacts.length === 0 && <div style={{ fontSize: 13, color: t.text.tertiary, padding: 4 }}>No contacts</div>}
              </div>
            </>
          )}
        </div>
        {!isClient && (
          <button onClick={() => setIsEditOpen(true)} style={{
            background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 8,
            padding: '6px 14px', fontSize: 13, fontWeight: 500, color: t.text.secondary,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>Edit Client</button>
        )}
      </InfoBar>

      {/* Two-column: Tasks + Quick links */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
        <div>
          <ClientUpdates clientId={clientId} isClient={isClient} />
        </div>

        <div>
          <Section label="Quick links">
            <CardGrid columns={2}>
              <Card onClick={() => router.push(`/design?client=${clientId}`)}>
                <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke={t.text.secondary} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 6 }}><path d="M10.5 2L14 5.5 5.5 14H2v-3.5z" /><line x1="8.5" y1="4" x2="12" y2="7.5" /></svg>
                <div style={{ fontSize: 15, fontWeight: 600, color: t.text.primary }}>Design</div>
                <div style={{ fontSize: 13, color: t.text.tertiary }}>Create print + digital assets</div>
              </Card>
              <Card onClick={() => router.push(`/clients/${clientId}/brand-kit${isClient ? '?viewMode=view' : ''}`)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={t.text.secondary} strokeWidth="1.3" style={{ marginBottom: 6 }}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1.2"/></svg>
                <div style={{ fontSize: 15, fontWeight: 600, color: t.text.primary }}>Brand Kit</div>
                <div style={{ fontSize: 13, color: t.text.tertiary }}>{bkMeta}</div>
              </Card>
              <Card onClick={() => router.push(`/clients/${clientId}/invoices`)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={t.text.secondary} strokeWidth="1.3" style={{ marginBottom: 6 }}><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 7h8M8 11h8M8 15h4" strokeLinecap="round"/></svg>
                <div style={{ fontSize: 15, fontWeight: 600, color: t.text.primary }}>Invoices</div>
                <div style={{ fontSize: 13, color: t.text.tertiary }}>{invMeta}</div>
              </Card>
              {!isClient && (
                <Card onClick={() => router.push(`/clients/${clientId}/financials`)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={t.text.secondary} strokeWidth="1.3" style={{ marginBottom: 6 }}><rect x="2" y="2" width="20" height="20" rx="2"/><line x1="7" y1="17" x2="7" y2="12" strokeLinecap="round"/><line x1="12" y1="17" x2="12" y2="8" strokeLinecap="round"/><line x1="17" y1="17" x2="17" y2="13" strokeLinecap="round"/></svg>
                  <div style={{ fontSize: 15, fontWeight: 600, color: t.text.primary }}>Financials</div>
                  <div style={{ fontSize: 13, color: t.text.tertiary }}>{finMeta}</div>
                </Card>
              )}
            </CardGrid>
          </Section>
        </div>
      </div>
    </PageLayout>
  );
}
