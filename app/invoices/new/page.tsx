'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/lib/theme';
import { DB, loadClients, loadContacts, saveInvoice } from '@/lib/database';
import { Invoice } from '@/lib/types';
import { PageShell, PageHeader, DataCard, GhostButton, CtaButton } from '@/components/shared/Brand';

function toDisplayDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function NewInvoicePage() {
  const { t } = useTheme();
  const router = useRouter();

  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [project, setProject] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]);
  const [lineItems, setLineItems] = useState([{ description: '', qty: 1, price: 0 }]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const init = async () => {
      if (DB.clientsState !== 'loaded') await loadClients();
      for (const c of DB.clients) {
        if (!DB.contacts[c.id]) await loadContacts(c.id).catch(() => {});
      }
      setClients(DB.clients);

      // Auto-generate next invoice number
      const existing = DB.invoices.map(i => i.id).filter(id => /^INV-\d+$/.test(id));
      const maxNum = existing.reduce((max, id) => {
        const n = parseInt(id.replace('INV-', ''), 10);
        return n > max ? n : max;
      }, 0);
      setInvoiceNumber(`INV-${String(maxNum + 1).padStart(4, '0')}`);
    };
    init();
  }, []);

  const subtotal = lineItems.reduce((sum, item) => sum + item.qty * item.price, 0);
  const total = subtotal;

  const addLineItem = () => setLineItems([...lineItems, { description: '', qty: 1, price: 0 }]);
  const updateLineItem = (index: number, field: string, value: any) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  };
  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const handleSave = async (status: 'draft' | 'sent') => {
    if (!selectedClient) return;
    setSaving(true);
    try {
      const inv: Invoice = {
        id: invoiceNumber,
        clientId: selectedClient,
        project,
        date: toDisplayDate(invoiceDate),
        due: toDisplayDate(dueDate),
        items: lineItems.filter(i => i.description.trim()),
        tax: 0,
        shipping: 0,
        status: status === 'sent' ? 'unpaid' : 'draft',
        notes,
      };
      await saveInvoice(inv);
      DB.invoices.push(inv);
      router.push('/invoices');
    } catch (e) {
      console.error('Failed to save invoice:', e);
    } finally {
      setSaving(false);
    }
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
        title="New Invoice"
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <GhostButton onClick={() => router.push('/invoices')}>Cancel</GhostButton>
            <GhostButton onClick={() => handleSave('draft')}>{saving ? 'Saving...' : 'Save Draft'}</GhostButton>
            <CtaButton onClick={() => handleSave('sent')}>{saving ? 'Saving...' : 'Send Invoice'}</CtaButton>
          </div>
        }
      />

      {/* TOP ROW: Client + Invoice Details */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* Client selector */}
        <DataCard>
          <div style={{ fontSize: 11, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 12 }}>Bill to</div>
          <select
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            style={{ ...inputStyle, fontSize: 14, padding: '10px 12px', cursor: 'pointer' }}
          >
            <option value="">Select a client...</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.company || c.name}</option>
            ))}
          </select>
          {selectedClientData && (
            <div style={{ marginTop: 12, fontSize: 13, color: t.text.secondary, lineHeight: 1.6 }}>
              <div style={{ fontWeight: 500, color: t.text.primary }}>{selectedClientData.company || selectedClientData.name}</div>
              {primaryContact && <div>{primaryContact.name}</div>}
              {primaryContact?.email && <div>{primaryContact.email}</div>}
              {primaryContact?.phone && <div>{primaryContact.phone}</div>}
            </div>
          )}
        </DataCard>

        {/* Invoice details */}
        <DataCard>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: t.text.secondary, marginBottom: 4, display: 'block' }}>Invoice #</label>
              <input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: t.text.secondary, marginBottom: 4, display: 'block' }}>Project</label>
              <input value={project} onChange={e => setProject(e.target.value)} placeholder="Project name" style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: t.text.secondary, marginBottom: 4, display: 'block' }}>Date</label>
              <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: t.text.secondary, marginBottom: 4, display: 'block' }}>Due date</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={inputStyle} />
            </div>
          </div>
        </DataCard>
      </div>

      {/* LINE ITEMS TABLE */}
      <DataCard noPadding>
        <div style={{ padding: '12px 20px', borderBottom: `1px solid ${t.border.default}` }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Line items</div>
        </div>

        {/* Header row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 100px 40px', gap: 12, padding: '10px 20px', borderBottom: `1px solid ${t.border.default}` }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase' }}>Description</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', textAlign: 'right' }}>Qty</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', textAlign: 'right' }}>Rate</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', textAlign: 'right' }}>Amount</span>
          <span />
        </div>

        {/* Line item rows */}
        {lineItems.map((item, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 100px 40px', gap: 12, padding: '10px 20px', borderBottom: `1px solid ${t.border.default}`, alignItems: 'center' }}>
            <input
              value={item.description}
              onChange={e => updateLineItem(i, 'description', e.target.value)}
              placeholder="Service description..."
              style={{ ...inputStyle, borderRadius: 6 }}
            />
            <input
              type="number" value={item.qty} min={1}
              onChange={e => updateLineItem(i, 'qty', parseInt(e.target.value) || 1)}
              style={{ ...inputStyle, borderRadius: 6, textAlign: 'right' }}
            />
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: t.text.tertiary }}>$</span>
              <input
                type="number" value={item.price} min={0} step={0.01}
                onChange={e => updateLineItem(i, 'price', parseFloat(e.target.value) || 0)}
                style={{ ...inputStyle, borderRadius: 6, textAlign: 'right', paddingLeft: 22 }}
              />
            </div>
            <span style={{ fontSize: 13, fontWeight: 500, color: t.text.primary, textAlign: 'right' }}>
              ${(item.qty * item.price).toFixed(2)}
            </span>
            <button
              onClick={() => removeLineItem(i)}
              style={{ width: 28, height: 28, border: 'none', borderRadius: 6, background: 'transparent', cursor: lineItems.length > 1 ? 'pointer' : 'default', color: lineItems.length > 1 ? t.text.tertiary : 'transparent', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}
            >×</button>
          </div>
        ))}

        {/* Add line item */}
        <div style={{ padding: '12px 20px' }}>
          <button onClick={addLineItem} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#2563eb', fontFamily: 'inherit' }}>
            + Add line item
          </button>
        </div>
      </DataCard>

      {/* TOTALS + NOTES */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        {/* Notes */}
        <DataCard>
          <div style={{ fontSize: 11, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 8 }}>Notes</div>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Payment terms, thank you note, etc."
            rows={4}
            style={{ ...inputStyle, resize: 'vertical' as const }}
          />
        </DataCard>

        {/* Totals */}
        <DataCard>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: t.text.secondary }}>Subtotal</span>
              <span style={{ color: t.text.primary, fontWeight: 500 }}>${subtotal.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: t.text.secondary }}>Tax</span>
              <span style={{ color: t.text.tertiary }}>$0.00</span>
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
