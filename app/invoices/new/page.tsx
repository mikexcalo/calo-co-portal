'use client';

import { useState, useEffect, useRef } from 'react';
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
  const [tax, setTax] = useState(0);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [confidenceFlags, setConfidenceFlags] = useState<Record<string, string>>({});
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);

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
  const total = subtotal + tax;

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
        tax,
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

  const handleFileUpload = async (file: File) => {
    setExtracting(true);
    setExtractionError(null);
    setConfidenceFlags({});
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch('/api/extract-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setExtractionError(data.error || 'Extraction failed. Try a different file.');
        return;
      }
      if (data.date) setInvoiceDate(data.date);
      if (data.lineItems?.length) {
        setLineItems(data.lineItems.map((item: any) => ({
          description: item.description || '',
          qty: item.qty || 1,
          price: item.rate || item.price || 0,
        })));
      }
      if (data.notes) setNotes(data.notes);
      if (data.tax) setTax(data.tax);
      if (data.vendor) {
        const match = clients.find(c =>
          (c.company || c.name || '').toLowerCase().includes(data.vendor.toLowerCase()) ||
          data.vendor.toLowerCase().includes((c.company || c.name || '').toLowerCase())
        );
        if (match) setSelectedClient(match.id);
      }
      if (data.confidence) setConfidenceFlags(data.confidence);
    } catch (err: any) {
      setExtractionError('Failed to process file. Try a screenshot instead of a PDF if the issue persists.');
      console.error('Extraction error:', err);
    } finally {
      setExtracting(false);
    }
  };

  const confBorder = (field: string): React.CSSProperties => {
    const c = confidenceFlags[field];
    if (c === 'low') return { borderLeft: '3px solid #f59e0b', paddingLeft: 10 };
    if (c === 'medium') return { borderLeft: '3px solid #fcd34d', paddingLeft: 10 };
    return {};
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

      {/* Receipt upload zone */}
      <div
        onClick={() => receiptInputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#2563eb'; }}
        onDragLeave={e => { e.currentTarget.style.borderColor = t.border.default; }}
        onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = t.border.default; const file = e.dataTransfer.files[0]; if (file) handleFileUpload(file); }}
        style={{ border: `1.5px dashed ${t.border.default}`, borderRadius: 10, padding: '20px 24px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', transition: 'border-color 150ms' }}
      >
        {extracting ? (
          <>
            <div style={{ width: 20, height: 20, border: `2px solid ${t.border.default}`, borderTopColor: '#2563eb', borderRadius: '50%', animation: 'receipt-spin 0.8s linear infinite' }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: t.text.primary }}>Extracting data...</div>
              <div style={{ fontSize: 12, color: t.text.tertiary }}>Reading your document</div>
            </div>
          </>
        ) : (
          <>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={t.text.tertiary} strokeWidth="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: t.text.primary }}>Drop a receipt, screenshot, or invoice</div>
              <div style={{ fontSize: 12, color: t.text.tertiary }}>Auto-fills the form with AI extraction</div>
            </div>
          </>
        )}
      </div>
      <input ref={receiptInputRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }}
        onChange={e => { const file = e.target.files?.[0]; if (file) handleFileUpload(file); e.target.value = ''; }} />
      <style>{`@keyframes receipt-spin { to { transform: rotate(360deg); } }`}</style>

      {extractionError && (
        <div style={{ padding: '10px 14px', marginBottom: 16, borderRadius: 8, background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)', fontSize: 13, color: t.status.danger, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>⚠</span>
          {extractionError}
          <button onClick={() => setExtractionError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 14, fontFamily: 'inherit' }}>×</button>
        </div>
      )}

      {/* TOP ROW: Client + Invoice Details */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* Client selector */}
        <DataCard>
          <div style={{ ...confBorder('vendor') }}>
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
          </div>
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
      <div style={{ ...confBorder('lineItems') }}>
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
      </div>

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
