'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  loadClients, saveInvoice, uploadInvoiceAttachment, logActivity,
  saveTaskNote, DB,
} from '@/lib/database';
import { invTotal, currency } from '@/lib/utils';
import ReceiptDrop from '@/components/invoices/ReceiptDrop';
import { Invoice, InvoiceItem } from '@/lib/types';
import styles from './page.module.css';

function genInvoiceId(clientId: string): string {
  const client = DB.clients.find((c) => c.id === clientId);
  if (!client) return 'CC-000-01';
  const count = DB.invoices.filter((i) => i.clientId === clientId).length + 1;
  const initials = (client.company || client.name).split(/\s+/).map((w) => w[0]).join('').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
  return `CC-${initials}-${String(count).padStart(2, '0')}`;
}

function calcTerms(date: string, due: string): string {
  const d1 = new Date(date), d2 = new Date(due);
  const days = Math.round((d2.getTime() - d1.getTime()) / 86400000);
  return days > 0 ? `Due within ${days} days` : 'Due on receipt';
}

const inputStyle: React.CSSProperties = {
  padding: '8px 10px', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 6,
  fontFamily: 'Inter, sans-serif', width: '100%', outline: 'none',
};
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 };

export default function NewInvoicePage() {
  const router = useRouter();
  const { id: clientId } = useParams() as { id: string };

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  const today = new Date().toISOString().split('T')[0];
  const due14 = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

  const [form, setForm] = useState({
    invoiceNumber: '', project: '', projectDesc: '', date: today, due: due14,
    terms: 'Due within 14 days', status: 'unpaid' as string,
    tax: 0, shipping: 0, notes: '',
  });
  const [items, setItems] = useState<(InvoiceItem & { _id: number })[]>([
    { description: '', qty: 1, price: 0, _id: 1 },
  ]);
  const [nextId, setNextId] = useState(2);

  useEffect(() => {
    (async () => {
      if (DB.clients.length === 0) await loadClients();
      setForm((f) => ({ ...f, invoiceNumber: genInvoiceId(clientId) }));
    })();
  }, [clientId]);

  const client = DB.clients.find((c) => c.id === clientId);
  const contacts = DB.contacts[clientId] || [];
  const primary = contacts.find((c) => c.isPrimary) || contacts[0];

  // Auto-calc terms when dates change
  useEffect(() => {
    setForm((f) => ({ ...f, terms: calcTerms(f.date, f.due) }));
  }, [form.date, form.due]);

  const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);
  const total = subtotal + form.tax + form.shipping;

  // OCR via server route — multi-image support
  const handleFilesSelected = async (newFiles: File[]) => {
    setFiles(newFiles);
    const imageFiles = newFiles.filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    setExtracting(true);
    setError(null);
    try {
      // Read ALL images as base64
      const images = await Promise.all(
        imageFiles.map((file) => new Promise<{ base64: string; mediaType: string }>((resolve) => {
          const r = new FileReader();
          r.onload = (e) => resolve({ base64: (e.target?.result as string).split(',')[1], mediaType: file.type });
          r.readAsDataURL(file);
        }))
      );

      const resp = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images }),
      });

      if (resp.ok) {
        const data = await resp.json();
        // Map new response shape: lineItems with description, subtitle, qty, price
        if (data.lineItems?.length) {
          let tid = nextId;
          setItems(data.lineItems.map((i: any) => ({
            description: [i.description, i.subtitle].filter(Boolean).join(' — '),
            qty: parseInt(i.qty) || 1,
            price: parseFloat(i.price) || 0,
            _id: tid++,
          })));
          setNextId(tid);
        }
        setForm((f) => ({
          ...f,
          project: data.projectName || f.project,
          projectDesc: data.projectDescription || f.projectDesc,
          tax: parseFloat(data.tax) || f.tax,
          shipping: parseFloat(data.shipping) || f.shipping,
          notes: data.notes || f.notes,
        }));
      } else {
        setError('Failed to extract receipt data.');
      }
    } catch { setError('OCR extraction failed.'); }
    finally { setExtracting(false); }
  };

  const handleSave = async () => {
    if (!client) { setError('Client not found'); return; }
    if (!items.some((i) => i.description.trim() && i.price > 0)) { setError('Add at least one line item'); return; }

    setSaving(true);
    setError(null);
    try {
      let attachmentUrl: string | null = null;
      if (files.length > 0) {
        attachmentUrl = await uploadInvoiceAttachment(files[0]).catch(() => null);
      }

      const invoice: Invoice = {
        id: form.invoiceNumber, clientId, project: form.project,
        date: form.date, due: form.due, status: form.status as any,
        items: items.map(({ _id, ...i }) => i), tax: form.tax, shipping: form.shipping,
        notes: form.notes, type: 'service', isReimbursement: false,
        netCost: 0, paidDate: null, internalNotes: '', projectDesc: form.projectDesc,
        vendorOrder: '—', vendorDate: '—', attachmentUrl,
      };

      await saveInvoice(invoice);
      const t = invTotal(invoice);
      await logActivity(clientId, 'invoice_created', { invoiceId: invoice.id, amount: t });

      // Client notification (#9)
      const dueStr = new Date(form.due).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      await saveTaskNote(clientId, 'note', `New invoice #${invoice.id} — ${currency(t)} due by ${dueStr}.`).catch(() => {});

      DB.invoices.push(invoice);
      router.push(`/clients/${clientId}/invoices`);
    } catch (e) {
      console.error('Save error:', e);
      setError('Failed to save invoice.');
    } finally { setSaving(false); }
  };

  // PDF generation (#3)
  const handleDownloadPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ unit: 'pt', format: 'letter' });
    const cName = client?.company || client?.name || '';
    let y = 50;

    // Header
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(18);
    pdf.text('CALO&CO', 50, y);
    pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#64748b');
    pdf.text(`${DB.agency.founder} · ${DB.agency.url} · ${DB.agency.location}`, 50, y + 14);

    // Invoice info — right aligned
    pdf.setTextColor('#1a1f2e'); pdf.setFontSize(10); pdf.setFont('helvetica', 'bold');
    pdf.text(form.invoiceNumber, 560, y, { align: 'right' });
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor('#64748b');
    pdf.text(`Date: ${form.date}`, 560, y + 14, { align: 'right' });
    pdf.text(`Due: ${form.due}`, 560, y + 26, { align: 'right' });
    pdf.text(`Terms: ${form.terms}`, 560, y + 38, { align: 'right' });
    pdf.text(`Status: ${form.status.toUpperCase()}`, 560, y + 50, { align: 'right' });
    y += 80;

    // Bill To
    pdf.setTextColor('#1a1f2e'); pdf.setFontSize(9); pdf.setFont('helvetica', 'bold');
    pdf.text('BILL TO', 50, y); y += 14;
    pdf.setFont('helvetica', 'normal');
    pdf.text(cName, 50, y); y += 12;
    if (primary?.name) { pdf.text(primary.name, 50, y); y += 12; }
    if (client?.address) { pdf.text(client.address, 50, y); y += 12; }
    if (client?.phone) { pdf.text(client.phone, 50, y); y += 12; }
    y += 10;

    // Project
    if (form.project) {
      pdf.setFont('helvetica', 'bold'); pdf.text('PROJECT', 50, y); y += 14;
      pdf.setFont('helvetica', 'normal'); pdf.text(form.project, 50, y); y += 12;
      if (form.projectDesc) { pdf.text(form.projectDesc, 50, y); y += 12; }
      y += 10;
    }

    // Line items header
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8);
    pdf.text('DESCRIPTION', 50, y); pdf.text('QTY', 380, y); pdf.text('PRICE', 430, y); pdf.text('AMOUNT', 560, y, { align: 'right' });
    y += 4; pdf.setDrawColor('#e2e8f0'); pdf.line(50, y, 560, y); y += 12;

    // Items
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9);
    items.forEach((item) => {
      if (!item.description) return;
      pdf.text(item.description, 50, y);
      pdf.text(String(item.qty), 385, y);
      pdf.text(`$${item.price.toFixed(2)}`, 430, y);
      pdf.text(`$${(item.qty * item.price).toFixed(2)}`, 560, y, { align: 'right' });
      y += 16;
    });
    y += 8; pdf.line(50, y, 560, y); y += 16;

    // Totals
    pdf.text('Subtotal', 430, y); pdf.text(`$${subtotal.toFixed(2)}`, 560, y, { align: 'right' }); y += 14;
    if (form.tax) { pdf.text('Tax', 430, y); pdf.text(`$${form.tax.toFixed(2)}`, 560, y, { align: 'right' }); y += 14; }
    if (form.shipping) { pdf.text('Shipping', 430, y); pdf.text(`$${form.shipping.toFixed(2)}`, 560, y, { align: 'right' }); y += 14; }
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11);
    pdf.text('Total Due', 430, y); pdf.text(`$${total.toFixed(2)}`, 560, y, { align: 'right' }); y += 24;

    // Payment methods
    const methods = DB.agencySettings.paymentMethods || [];
    if (methods.length > 0) {
      pdf.setFontSize(8); pdf.setFont('helvetica', 'bold');
      pdf.text('PAYMENT METHODS', 50, y); y += 14;
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9);
      methods.forEach((m: any) => { pdf.text(`${m.method}: ${m.handle}`, 50, y); y += 12; });
      y += 8;
    }

    // Notes
    if (form.notes) {
      pdf.setFontSize(8); pdf.setFont('helvetica', 'bold'); pdf.text('NOTES', 50, y); y += 14;
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9);
      pdf.text(pdf.splitTextToSize(form.notes, 500), 50, y); y += 20;
    }

    // Footer
    pdf.setFontSize(8); pdf.setTextColor('#94a3b8');
    pdf.text('CALO&CO · mikecalo.co', 306, 750, { align: 'center' });

    pdf.save(`CALO_CO_Invoice_${form.invoiceNumber}.pdf`);
  };

  // Email button (#9)
  const handleEmail = () => {
    const email = primary?.email || client?.email || '';
    const subj = encodeURIComponent(`Invoice #${form.invoiceNumber} from CALO&CO`);
    const body = encodeURIComponent(`Hi ${primary?.name || ''},\n\nPlease find attached invoice #${form.invoiceNumber} for ${currency(total)}, due by ${form.due}.\n\nThank you,\nMike Calo\nCALO&CO`);
    window.open(`mailto:${email}?subject=${subj}&body=${body}`);
  };

  return (
    <div className={`page ${styles.page}`}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1f2e', margin: 0 }}>New Invoice</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleDownloadPDF} className="btn btn-ghost btn-sm">Download PDF</button>
          <button onClick={handleEmail} className="btn btn-ghost btn-sm">Send via Email</button>
        </div>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.layout}>
        {/* Left: Receipt upload */}
        <div className={styles.leftPanel}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#334155', margin: '0 0 8px' }}>Receipt / Screenshot</h3>
          <ReceiptDrop onFilesSelected={handleFilesSelected} isLoading={saving || extracting} />
          {extracting && <p style={{ fontSize: 12, color: '#2563eb', fontWeight: 500 }}>Extracting from {files.filter((f) => f.type.startsWith('image/')).length} image{files.filter((f) => f.type.startsWith('image/')).length !== 1 ? 's' : ''}...</p>}
        </div>

        {/* Right: Invoice form */}
        <div className={styles.rightPanel}>
          {/* Invoice Number + Status */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={labelStyle}>Invoice Number</label>
              <input value={form.invoiceNumber} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                style={{ ...inputStyle, background: '#fff' }}>
                <option value="unpaid">Unpaid</option><option value="paid">Paid</option><option value="overdue">Overdue</option>
              </select></div>
          </div>

          {/* Bill To — auto-populated */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px', marginTop: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Bill To</div>
            <div style={{ fontSize: 13, color: '#1a1f2e', fontWeight: 600 }}>{client?.company || client?.name || '—'}</div>
            {primary?.name && <div style={{ fontSize: 12, color: '#64748b' }}>{primary.name}</div>}
            {client?.address && <div style={{ fontSize: 12, color: '#64748b' }}>{client.address}</div>}
            {client?.phone && <div style={{ fontSize: 12, color: '#64748b' }}>{client.phone}</div>}
          </div>

          {/* Dates + Terms */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 12 }}>
            <div><label style={labelStyle}>Invoice Date</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>Due Date</label>
              <input type="date" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>Terms</label>
              <input value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} style={inputStyle} /></div>
          </div>

          {/* Project */}
          <div style={{ marginTop: 12 }}>
            <label style={labelStyle}>Project Name</label>
            <input value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} placeholder="e.g. Brand Merchandise" style={inputStyle} />
          </div>
          <div style={{ marginTop: 8 }}>
            <label style={labelStyle}>Project Description</label>
            <textarea value={form.projectDesc} onChange={(e) => setForm({ ...form, projectDesc: e.target.value })} rows={2}
              placeholder="Optional description..." style={{ ...inputStyle, resize: 'vertical' }} />
          </div>

          {/* Line Items */}
          <div style={{ marginTop: 16 }}>
            <label style={labelStyle}>Line Items</label>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ textAlign: 'left', padding: '6px 0', fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Description</th>
                  <th style={{ width: 60, fontSize: 10, fontWeight: 600, color: '#94a3b8' }}>Qty</th>
                  <th style={{ width: 80, fontSize: 10, fontWeight: 600, color: '#94a3b8', textAlign: 'right' }}>Price</th>
                  <th style={{ width: 30 }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '4px 0' }}>
                      <input value={item.description} onChange={(e) => setItems((p) => p.map((i) => i._id === item._id ? { ...i, description: e.target.value } : i))}
                        placeholder="Item name" style={{ ...inputStyle, border: 'none', padding: '6px 4px' }} />
                    </td>
                    <td><input type="number" min="1" value={item.qty}
                      onChange={(e) => setItems((p) => p.map((i) => i._id === item._id ? { ...i, qty: parseInt(e.target.value) || 1 } : i))}
                      style={{ ...inputStyle, border: 'none', width: 50, textAlign: 'center', padding: '6px 2px' }} /></td>
                    <td><input type="number" step="0.01" value={item.price.toFixed(2)}
                      onChange={(e) => setItems((p) => p.map((i) => i._id === item._id ? { ...i, price: parseFloat(e.target.value) || 0 } : i))}
                      style={{ ...inputStyle, border: 'none', width: 70, textAlign: 'right', padding: '6px 2px' }} /></td>
                    <td><button onClick={() => setItems((p) => p.filter((i) => i._id !== item._id))}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16 }}>×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={() => { setItems([...items, { description: '', qty: 1, price: 0, _id: nextId }]); setNextId(nextId + 1); }}
              style={{ marginTop: 8, background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#334155' }}>
              + Add Item
            </button>
          </div>

          {/* Totals */}
          <div style={{ marginTop: 16, borderTop: '1px solid #e2e8f0', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span>Subtotal</span><span>{currency(subtotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, alignItems: 'center' }}>
              <span>Tax</span>
              <input type="number" step="0.01" value={form.tax.toFixed(2)}
                onChange={(e) => setForm({ ...form, tax: parseFloat(e.target.value) || 0 })}
                style={{ width: 80, textAlign: 'right', padding: '4px 6px', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 12 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, alignItems: 'center' }}>
              <span>Shipping</span>
              <input type="number" step="0.01" value={form.shipping.toFixed(2)}
                onChange={(e) => setForm({ ...form, shipping: parseFloat(e.target.value) || 0 })}
                style={{ width: 80, textAlign: 'right', padding: '4px 6px', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 12 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>
              <span>Total Due</span><span>{currency(total)}</span>
            </div>
          </div>

          {/* Payment Methods from Settings */}
          {DB.agencySettings.paymentMethods?.length > 0 && (
            <div style={{ marginTop: 16, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Payment Methods</div>
              {DB.agencySettings.paymentMethods.map((m: any, i: number) => (
                <div key={i} style={{ fontSize: 12, color: '#475569' }}>{m.method}: {m.handle}</div>
              ))}
            </div>
          )}

          {/* Notes */}
          <div style={{ marginTop: 12 }}>
            <label style={labelStyle}>Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2}
              placeholder="Optional note to client..." style={{ ...inputStyle, resize: 'vertical' }} />
          </div>

          {/* Save */}
          <button onClick={handleSave} disabled={saving} className="cta-btn" style={{ marginTop: 16, width: '100%' }}>
            {saving ? 'Saving...' : 'Create Invoice'}
          </button>
        </div>
      </div>
    </div>
  );
}
