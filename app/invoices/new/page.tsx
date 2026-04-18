'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from '@/lib/theme';
import { DB, loadClients, loadContacts, loadInvoices, saveInvoice } from '@/lib/database';
import { Invoice } from '@/lib/types';
import { PageShell, PageHeader, DataCard, GhostButton, CtaButton } from '@/components/shared/Brand';
import { formatPhone } from '@/lib/utils';

function toDisplayDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function NewInvoicePage() {
  return <Suspense fallback={null}><NewInvoiceContent /></Suspense>;
}

function NewInvoiceContent() {
  const { t } = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');
  const fromQuoteId = searchParams.get('from_quote');

  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [sourceQuoteId, setSourceQuoteId] = useState<string | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [project, setProject] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]);
  const [lineItems, setLineItems] = useState([{ description: '', qty: 1, price: 0 }]);
  const [notes, setNotes] = useState('');
  const [tax, setTax] = useState(0);
  const [invoiceType, setInvoiceType] = useState<'service' | 'reimbursement'>('service');
  const [editUuid, setEditUuid] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [confidenceFlags, setConfidenceFlags] = useState<Record<string, string>>({});
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [queuedFiles, setQueuedFiles] = useState<{ name: string; dataUrl: string }[]>([]);
  const receiptInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const init = async () => {
      if (DB.clientsState !== 'loaded') await loadClients();
      for (const c of DB.clients) {
        if (!DB.contacts[c.id]) await loadContacts(c.id).catch(() => {});
        if (!DB.invoices.some(i => i.clientId === c.id)) await loadInvoices(c.id).catch(() => {});
      }
      setClients(DB.clients);

      // Invoice # stays empty until client is selected (client-scoped generator below)

      // Load existing invoice for edit mode
      if (editId) {
        const inv = DB.invoices.find(i => i._uuid === editId || i.id === editId);
        if (inv) {
          setEditUuid(inv._uuid || null);
          setSelectedClient(inv.clientId || '');
          setInvoiceNumber(inv.id || '');
          setProject(inv.project || '');
          setNotes(inv.notes || '');
          setTax(inv.tax || 0);
          setInvoiceType((inv as any).type || 'service');
          if (inv.items?.length) setLineItems(inv.items.map(i => ({ description: i.description, qty: i.qty, price: i.price })));
          // Parse display dates back to ISO
          try { if (inv.date) setInvoiceDate(new Date(inv.date).toISOString().split('T')[0]); } catch {}
          try { if (inv.due) setDueDate(new Date(inv.due).toISOString().split('T')[0]); } catch {}
        }
      }

      // Pre-fill from quote (Q3: convert accepted quote to invoice)
      if (fromQuoteId && !editId) {
        try {
          const supabase = (await import('@/lib/supabase')).default;
          const { data: q } = await supabase.from('quotes').select('*').eq('id', fromQuoteId).single();
          if (q) {
            setSelectedClient(q.client_id || '');
            setNotes(q.notes || '');
            setTax(q.tax || 0);
            if (Array.isArray(q.line_items) && q.line_items.length) setLineItems(q.line_items);
            setSourceQuoteId(q.id);
            if (q.project_name) setProject(q.project_name);
          }
        } catch {}
      }
    };
    init();
  }, [editId, fromQuoteId]);

  // Per-client invoice numbering: AgencyCode-ClientCode-Seq
  useEffect(() => {
    if (editId || !selectedClient) return;
    const client = DB.clients.find((c: any) => c.id === selectedClient);
    if (!client) return;
    const clientCode = (client as any).code || client.company?.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 4);
    if (!clientCode) return;
    const prefix = `INV-${clientCode}-`;
    const maxSeq = DB.invoices
      .filter((i: any) => i.clientId === selectedClient && typeof i.id === 'string' && i.id.startsWith(prefix))
      .map((i: any) => parseInt(i.id.slice(prefix.length), 10))
      .filter((n: number) => !isNaN(n))
      .reduce((max: number, n: number) => (n > max ? n : max), 0);
    setInvoiceNumber(`${prefix}${String(maxSeq + 1).padStart(2, '0')}`);
  }, [selectedClient, editId]);

  // Auto-update due date when issue date changes (non-edit mode)
  useEffect(() => {
    if (editId || !invoiceDate) return;
    const issued = new Date(invoiceDate + 'T00:00:00');
    const newDue = new Date(issued.getTime() + 14 * 86400000);
    setDueDate(newDue.toISOString().split('T')[0]);
  }, [invoiceDate, editId]);


  const subtotal = lineItems.reduce((sum, item) => sum + item.qty * item.price, 0);
  const total = subtotal + (invoiceType === 'reimbursement' ? 0 : tax);

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
    setSaving(true);
    try {
      const inv: Invoice = {
        id: invoiceNumber,
        _uuid: editUuid || undefined,
        clientId: selectedClient,
        project,
        date: toDisplayDate(invoiceDate),
        due: toDisplayDate(dueDate),
        items: lineItems.filter(i => i.description.trim()),
        tax,
        shipping: 0,
        status: status === 'sent' ? 'unpaid' : 'draft',
        notes,
        type: invoiceType,
      } as any;
      if (sourceQuoteId) (inv as any).sourceQuoteId = sourceQuoteId;
      await saveInvoice(inv);
      if (!editUuid) DB.invoices.push(inv);
      router.push('/invoices');
    } catch (e) {
      console.error('Failed to save invoice:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleFilesAdded = async (files: File[]) => {
    const newFiles: { name: string; dataUrl: string }[] = [];
    for (const file of files) {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      newFiles.push({ name: file.name, dataUrl });
    }
    setQueuedFiles(prev => [...prev, ...newFiles]);
  };

  const handleExtract = async () => {
    if (!queuedFiles.length) return;
    setExtracting(true);
    setExtractionError(null);
    setConfidenceFlags({});
    try {
      const res = await fetch('/api/extract-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: queuedFiles.map(f => f.dataUrl) }),
      });
      const data = await res.json();
      if (!res.ok) { setExtractionError(data.error || 'Extraction failed.'); return; }
      // Don't overwrite issue date from receipt — keep today's date. Receipt dates are in notes.
      if (data.tax) setTax(data.tax);
      if (data.lineItems?.length) {
        setLineItems(data.lineItems.map((item: any) => ({
          description: item.description || '',
          qty: item.qty || 1,
          price: item.rate || item.price || 0,
        })));
      }
      if (data.notes) setNotes(data.notes);
      if (data.vendor) {
        const match = clients.find(c =>
          (c.company || c.name || '').toLowerCase().includes(data.vendor.toLowerCase()) ||
          data.vendor.toLowerCase().includes((c.company || c.name || '').toLowerCase())
        );
        if (match) setSelectedClient(match.id);
      }
      if (data.confidence) setConfidenceFlags(data.confidence);
      setQueuedFiles([]);
    } catch (err: any) {
      setExtractionError('Failed to process files.');
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
        title={editId ? 'Edit Invoice' : 'New Invoice'}
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <GhostButton onClick={() => router.push('/invoices')}>Cancel</GhostButton>
            <div style={{ width: 1, height: 20, background: t.border.default, margin: '0 4px' }} />
            <GhostButton onClick={() => handleSave('draft')} icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>}>{saving ? 'Saving...' : 'Save Draft'}</GhostButton>
            {editId && (
              <GhostButton onClick={() => window.open(`/invoices/${invoiceNumber}/print`, '_blank')} icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}>Preview</GhostButton>
            )}
            {editId && (
              <GhostButton onClick={() => window.open(`/invoices/${invoiceNumber}/print?download=1`, '_blank')} icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>}>Download</GhostButton>
            )}
            <CtaButton onClick={() => handleSave('sent')} icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg>}>{saving ? 'Saving...' : 'Mark as Sent'}</CtaButton>
          </div>
        }
      />

      {/* Receipt upload zone */}
      <div
        onClick={() => { if (!queuedFiles.length && !extracting) receiptInputRef.current?.click(); }}
        onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#2563eb'; }}
        onDragLeave={e => { e.currentTarget.style.borderColor = t.border.default; }}
        onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = t.border.default; const files = Array.from(e.dataTransfer.files); if (files.length) handleFilesAdded(files); }}
        style={{ border: `1.5px dashed ${t.border.default}`, borderRadius: 10, padding: '20px 24px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, cursor: queuedFiles.length ? 'default' : 'pointer', transition: 'border-color 150ms' }}
      >
        {extracting ? (
          <>
            <div style={{ width: 20, height: 20, border: `2px solid ${t.border.default}`, borderTopColor: '#2563eb', borderRadius: '50%', animation: 'receipt-spin 0.8s linear infinite' }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: t.text.primary }}>Extracting from {queuedFiles.length} file{queuedFiles.length !== 1 ? 's' : ''}...</div>
              <div style={{ fontSize: 12, color: t.text.tertiary }}>Combining data from all sources</div>
            </div>
          </>
        ) : queuedFiles.length > 0 ? (
          <div style={{ width: '100%' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              {queuedFiles.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 6, background: t.bg.surfaceHover, fontSize: 12, color: t.text.secondary }}>
                  <span>{f.name.length > 25 ? f.name.slice(0, 22) + '...' : f.name}</span>
                  <button onClick={(e) => { e.stopPropagation(); setQueuedFiles(prev => prev.filter((_, j) => j !== i)); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.text.tertiary, fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={(e) => { e.stopPropagation(); handleExtract(); }}
                style={{ padding: '6px 16px', fontSize: 13, fontWeight: 500, borderRadius: 6, border: 'none', cursor: 'pointer', background: '#2563eb', color: '#fff', fontFamily: 'inherit' }}>Extract data</button>
              <button onClick={(e) => { e.stopPropagation(); receiptInputRef.current?.click(); }}
                style={{ padding: '6px 16px', fontSize: 13, fontWeight: 500, borderRadius: 6, border: `1px solid ${t.border.default}`, cursor: 'pointer', background: 'transparent', color: t.text.secondary, fontFamily: 'inherit' }}>+ Add more</button>
              <button onClick={(e) => { e.stopPropagation(); setQueuedFiles([]); }}
                style={{ padding: '6px 16px', fontSize: 13, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'transparent', color: t.text.tertiary, fontFamily: 'inherit' }}>Clear</button>
            </div>
          </div>
        ) : (
          <>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={t.text.tertiary} strokeWidth="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: t.text.primary }}>Drop receipts, screenshots, or invoices</div>
              <div style={{ fontSize: 12, color: t.text.tertiary }}>Add multiple files — auto-fills the form with AI extraction</div>
            </div>
          </>
        )}
      </div>
      <input ref={receiptInputRef} type="file" accept="image/*,.pdf,application/pdf" multiple style={{ display: 'none' }}
        onChange={e => { const files = Array.from(e.target.files || []); if (files.length) handleFilesAdded(files); e.target.value = ''; }} />
      <style>{`@keyframes receipt-spin { to { transform: rotate(360deg); } }`}</style>

      {extractionError && (
        <div style={{ padding: '10px 14px', marginBottom: 16, borderRadius: 8, background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)', fontSize: 13, color: t.status.danger, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>⚠</span>
          {extractionError}
          <button onClick={() => setExtractionError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 14, fontFamily: 'inherit' }}>×</button>
        </div>
      )}

      {/* TOP ROW: Client + Invoice Details */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24, alignItems: 'start' }}>
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
              {primaryContact?.phone && <div>{formatPhone(primaryContact.phone)}</div>}
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
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${t.border.default}` }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: t.text.secondary, marginBottom: 6 }}>Invoice type</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { value: 'service' as const, label: 'Service revenue', hint: 'Work you performed' },
                { value: 'reimbursement' as const, label: 'Reimbursement', hint: 'Passthrough vendor cost' },
              ].map((opt) => {
                const selected = invoiceType === opt.value;
                return (
                  <button key={opt.value} type="button" onClick={() => setInvoiceType(opt.value)}
                    style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: `1px solid ${selected ? '#2563eb' : t.border.default}`, background: selected ? 'rgba(37,99,235,0.04)' : t.bg.surface, color: t.text.primary, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, textAlign: 'left' as const, transition: 'all 150ms' }}>
                    <div style={{ fontWeight: 500, marginBottom: 2 }}>{opt.label}</div>
                    <div style={{ fontSize: 10, color: t.text.tertiary }}>{opt.hint}</div>
                  </button>
                );
              })}
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
            {invoiceType !== 'reimbursement' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                <span style={{ color: t.text.secondary }}>Tax</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <span style={{ color: t.text.tertiary, fontSize: 13 }}>$</span>
                  <input type="number" value={tax} min={0} step={0.01} onChange={e => setTax(parseFloat(e.target.value) || 0)}
                    style={{ width: 70, textAlign: 'right', padding: '4px 8px', border: `1px solid ${t.border.default}`, borderRadius: 6, background: t.bg.primary, color: t.text.primary, fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
                </div>
              </div>
            )}
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
