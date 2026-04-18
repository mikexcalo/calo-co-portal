'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from '@/lib/theme';
import { DB, loadClients, loadContacts } from '@/lib/database';
import { PageShell, PageHeader, DataCard, GhostButton, CtaButton } from '@/components/shared/Brand';
import { formatPhone } from '@/lib/utils';
import supabase from '@/lib/supabase';

function toDisplayDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function NewQuotePage() {
  return <Suspense fallback={null}><NewQuoteContent /></Suspense>;
}

function NewQuoteContent() {
  const { t } = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');

  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [quoteNumber, setQuoteNumber] = useState('');
  const [project, setProject] = useState('');
  const [issuedDate, setIssuedDate] = useState(new Date().toISOString().split('T')[0]);
  const [expiresDate, setExpiresDate] = useState(new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]);
  const [lineItems, setLineItems] = useState([{ description: '', qty: 1, price: 0 }]);
  const [notes, setNotes] = useState('');
  const [tax, setTax] = useState(0);
  const [editUuid, setEditUuid] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const init = async () => {
      if (DB.clientsState !== 'loaded') await loadClients();
      for (const c of DB.clients) {
        if (!DB.contacts[c.id]) await loadContacts(c.id).catch(() => {});
      }
      setClients(DB.clients);

      if (editId) {
        try {
          const { data: q } = await supabase.from('quotes').select('*').eq('id', editId).single();
          if (q) {
            setEditUuid(q.id);
            setSelectedClient(q.client_id || '');
            setQuoteNumber(q.quote_number || '');
            setProject(q.project_name || '');
            setNotes(q.notes || '');
            setTax(q.tax || 0);
            if (Array.isArray(q.line_items) && q.line_items.length) setLineItems(q.line_items);
            if (q.issued_date) setIssuedDate(q.issued_date);
            if (q.expires_date) setExpiresDate(q.expires_date);
          }
        } catch {}
      }
    };
    init();
  }, [editId]);

  // Per-client quote numbering
  useEffect(() => {
    if (editId || !selectedClient) return;
    const client = DB.clients.find((c: any) => c.id === selectedClient);
    if (!client) return;
    const clientCode = (client as any).code || client.company?.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 4);
    if (!clientCode) return;
    (async () => {
      const { data } = await supabase.from('quotes').select('quote_number').eq('client_id', selectedClient);
      const prefix = `QUO-${clientCode}-`;
      const maxSeq = (data || [])
        .map((q: any) => q.quote_number)
        .filter((n: string) => n?.startsWith(prefix))
        .map((n: string) => parseInt(n.slice(prefix.length), 10))
        .filter((n: number) => !isNaN(n))
        .reduce((max: number, n: number) => (n > max ? n : max), 0);
      setQuoteNumber(`${prefix}${String(maxSeq + 1).padStart(2, '0')}`);
    })();
  }, [selectedClient, editId]);

  // Auto-update expires when issued changes (non-edit)
  useEffect(() => {
    if (editId || !issuedDate) return;
    const d = new Date(issuedDate + 'T00:00:00');
    setExpiresDate(new Date(d.getTime() + 30 * 86400000).toISOString().split('T')[0]);
  }, [issuedDate, editId]);

  const subtotal = lineItems.reduce((s, i) => s + i.qty * i.price, 0);
  const total = subtotal + tax;

  const addLineItem = () => setLineItems([...lineItems, { description: '', qty: 1, price: 0 }]);
  const updateLineItem = (idx: number, field: string, val: any) => { const u = [...lineItems]; u[idx] = { ...u[idx], [field]: val }; setLineItems(u); };
  const removeLineItem = (idx: number) => { if (lineItems.length > 1) setLineItems(lineItems.filter((_, i) => i !== idx)); };

  const handleSave = async (status: 'draft' | 'sent') => {
    setSaving(true);
    try {
      const row: any = {
        client_id: selectedClient || null,
        quote_number: quoteNumber,
        status,
        issued_date: issuedDate,
        expires_date: expiresDate,
        project_name: project || null,
        line_items: lineItems.filter(i => i.description.trim()),
        subtotal,
        tax,
        total,
        notes: notes || null,
      };
      if (editUuid) {
        await supabase.from('quotes').update(row).eq('id', editUuid);
      } else {
        await supabase.from('quotes').insert(row);
      }
      router.push('/quotes');
    } catch (e) { console.error('Failed to save quote:', e); }
    finally { setSaving(false); }
  };

  const selectedClientData = clients.find(c => c.id === selectedClient);
  const primaryContact = selectedClient ? (DB.contacts[selectedClient] || []).find((c: any) => c.isPrimary) || (DB.contacts[selectedClient] || [])[0] : null;

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', fontSize: 13,
    border: `1px solid ${t.border.default}`, borderRadius: 8,
    background: t.bg.primary, color: t.text.primary,
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 150ms',
  };

  return (
    <PageShell>
      <PageHeader
        title={editId ? 'Edit Quote' : 'New Quote'}
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <GhostButton onClick={() => router.push('/quotes')}>Cancel</GhostButton>
            <div style={{ width: 1, height: 20, background: t.border.default, margin: '0 4px' }} />
            <GhostButton onClick={() => handleSave('draft')} icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>}>{saving ? 'Saving...' : 'Save Draft'}</GhostButton>
            <CtaButton onClick={() => handleSave('sent')} icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg>}>{saving ? 'Saving...' : 'Send Quote'}</CtaButton>
          </div>
        }
      />

      {/* TOP ROW */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24, alignItems: 'start' }}>
        <DataCard>
          <div style={{ fontSize: 11, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 12 }}>Quote for</div>
          <select value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)} style={{ ...inputStyle, fontSize: 14, padding: '10px 12px', cursor: 'pointer' }}>
            <option value="">Select a client...</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.company || c.name}</option>)}
          </select>
          {selectedClientData && (
            <div style={{ marginTop: 12, fontSize: 13, color: t.text.secondary, lineHeight: 1.6 }}>
              <div style={{ fontWeight: 500, color: t.text.primary }}>{selectedClientData.company || selectedClientData.name}</div>
              {primaryContact && <div>{primaryContact.name}</div>}
              {primaryContact?.email && <div>{primaryContact.email}</div>}
              {primaryContact?.phone && <div>{formatPhone(primaryContact.phone)}</div>}
            </div>
          )}
        </DataCard>

        <DataCard>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={{ fontSize: 12, fontWeight: 500, color: t.text.secondary, marginBottom: 4, display: 'block' }}>Quote #</label><input value={quoteNumber} onChange={e => setQuoteNumber(e.target.value)} style={inputStyle} /></div>
            <div><label style={{ fontSize: 12, fontWeight: 500, color: t.text.secondary, marginBottom: 4, display: 'block' }}>Project</label><input value={project} onChange={e => setProject(e.target.value)} placeholder="Project name" style={inputStyle} /></div>
            <div><label style={{ fontSize: 12, fontWeight: 500, color: t.text.secondary, marginBottom: 4, display: 'block' }}>Issued</label><input type="date" value={issuedDate} onChange={e => setIssuedDate(e.target.value)} style={inputStyle} /></div>
            <div><label style={{ fontSize: 12, fontWeight: 500, color: t.text.secondary, marginBottom: 4, display: 'block' }}>Expires</label><input type="date" value={expiresDate} onChange={e => setExpiresDate(e.target.value)} style={inputStyle} /></div>
          </div>
        </DataCard>
      </div>

      {/* LINE ITEMS */}
      <DataCard noPadding>
        <div style={{ padding: '12px 20px', borderBottom: `1px solid ${t.border.default}` }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Line items</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 100px 40px', gap: 12, padding: '10px 20px', borderBottom: `1px solid ${t.border.default}` }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase' }}>Description</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', textAlign: 'right' }}>Qty</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', textAlign: 'right' }}>Rate</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', textAlign: 'right' }}>Amount</span>
          <span />
        </div>
        {lineItems.map((item, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 100px 40px', gap: 12, padding: '10px 20px', borderBottom: `1px solid ${t.border.default}`, alignItems: 'center' }}>
            <input value={item.description} onChange={e => updateLineItem(i, 'description', e.target.value)} placeholder="Service description..." style={{ ...inputStyle, borderRadius: 6 }} />
            <input type="number" value={item.qty} min={1} onChange={e => updateLineItem(i, 'qty', parseInt(e.target.value) || 1)} style={{ ...inputStyle, borderRadius: 6, textAlign: 'right' }} />
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: t.text.tertiary }}>$</span>
              <input type="number" value={item.price} min={0} step={0.01} onChange={e => updateLineItem(i, 'price', parseFloat(e.target.value) || 0)} style={{ ...inputStyle, borderRadius: 6, textAlign: 'right', paddingLeft: 22 }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 500, color: t.text.primary, textAlign: 'right' }}>${(item.qty * item.price).toFixed(2)}</span>
            <button onClick={() => removeLineItem(i)} style={{ width: 28, height: 28, border: 'none', borderRadius: 6, background: 'transparent', cursor: lineItems.length > 1 ? 'pointer' : 'default', color: lineItems.length > 1 ? t.text.tertiary : 'transparent', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>×</button>
          </div>
        ))}
        <div style={{ padding: '12px 20px' }}>
          <button onClick={addLineItem} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: t.accent.primary, fontFamily: 'inherit' }}>+ Add line item</button>
        </div>
      </DataCard>

      {/* TOTALS + NOTES */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        <DataCard>
          <div style={{ fontSize: 11, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 8 }}>Notes</div>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Scope details, terms, exclusions..." rows={4} style={{ ...inputStyle, resize: 'vertical' as const }} />
        </DataCard>
        <DataCard>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: t.text.secondary }}>Subtotal</span>
              <span style={{ color: t.text.primary, fontWeight: 500 }}>${subtotal.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
              <span style={{ color: t.text.secondary }}>Tax</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <span style={{ color: t.text.tertiary, fontSize: 13 }}>$</span>
                <input type="number" value={tax} min={0} step={0.01} onChange={e => setTax(parseFloat(e.target.value) || 0)}
                  style={{ width: 70, textAlign: 'right', padding: '4px 8px', border: `1px solid ${t.border.default}`, borderRadius: 6, background: t.bg.primary, color: t.text.primary, fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
              </div>
            </div>
            <div style={{ borderTop: `1px solid ${t.border.default}`, paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: t.text.primary }}>Total</span>
              <span style={{ fontSize: 18, fontWeight: 500, color: t.text.primary }}>${total.toFixed(2)}</span>
            </div>
          </div>
        </DataCard>
      </div>
    </PageShell>
  );
}
