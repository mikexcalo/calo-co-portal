'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { DB, loadClients, loadInvoices, loadContacts, loadAgencySettings } from '@/lib/database';

function money(n: number) {
  return `$${(n || 0).toFixed(2)}`;
}

export default function InvoicePrintPage() {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [contact, setContact] = useState<any>(null);
  const [agency, setAgency] = useState<any>({});
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try { await loadAgencySettings(); } catch {}

      if (DB.clientsState !== 'loaded') await loadClients().catch(() => {});
      for (const c of DB.clients) {
        if (!DB.invoices.some((i: any) => i.clientId === c.id)) {
          await loadInvoices(c.id).catch(() => {});
        }
      }

      const inv = DB.invoices.find((i: any) => i._uuid === id || i.id === id);
      if (inv) {
        setInvoice(inv);
        const cl = DB.clients.find((c: any) => c.id === inv.clientId);
        if (cl) {
          setClient(cl);
          if (!DB.contacts[cl.id]) await loadContacts(cl.id).catch(() => {});
          const contacts = DB.contacts[cl.id] || [];
          setContact(contacts.find((c: any) => c.isPrimary) || contacts[0] || null);
        }
      }

      let profile: any = {};
      let agencySettings: any = {};
      try { profile = JSON.parse(localStorage.getItem('calo-settings-profile') || '{}'); } catch {}
      try { agencySettings = JSON.parse(localStorage.getItem('calo-agency-settings') || '{}'); } catch {}
      setAgency({ ...profile, ...agencySettings });
      setPaymentMethods(DB.agencySettings?.paymentMethods || []);
      setReady(true);
    })();
  }, [id]);

  useEffect(() => {
    if (ready && invoice) {
      const t = setTimeout(() => window.print(), 600);
      return () => clearTimeout(t);
    }
  }, [ready, invoice]);

  if (!ready) return null;
  if (!invoice) {
    return <div style={{ padding: 40, fontFamily: 'system-ui' }}>Invoice not found.</div>;
  }

  const subtotal = (invoice.items || []).reduce(
    (s: number, it: any) => s + ((it.qty || 0) * (it.price || 0)),
    0
  );
  const tax = invoice.tax || 0;
  const shipping = invoice.shipping || 0;
  const total = subtotal + tax + shipping;
  const statusLabel =
    invoice.status === 'paid' ? 'PAID' :
    invoice.status === 'draft' ? 'DRAFT' : 'UNPAID';
  const statusBg = statusLabel === 'PAID' ? '#d1fae5' : statusLabel === 'UNPAID' ? '#fee2e2' : '#e5e7eb';
  const statusFg = statusLabel === 'PAID' ? '#065f46' : statusLabel === 'UNPAID' ? '#991b1b' : '#374151';

  return (
    <>
      <style>{`
        @page { size: letter; margin: 0.5in; }
        @media print {
          body { background: white !important; }
          .ip-overlay { position: static !important; padding: 0 !important; overflow: visible !important; }
          .ip-no-print { display: none !important; }
        }
      `}</style>
      <div
        className="ip-overlay"
        style={{
          position: 'fixed', inset: 0, zIndex: 9999, background: 'white',
          overflow: 'auto', padding: '48px 40px', color: '#111',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        }}
      >
        <div style={{ maxWidth: 720, margin: '0 auto', fontSize: 11, lineHeight: 1.5 }}>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 40 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5, marginBottom: 8 }}>
                {agency.companyName || 'CALO&CO'}
              </div>
              <div style={{ color: '#555' }}>
                {agency.name || 'Mike Calo'}{agency.title ? `, ${agency.title}` : ', Founder'}
              </div>
              <div style={{ color: '#555' }}>mikecalo.co</div>
              <div style={{ color: '#555' }}>{agency.city || 'Portland, Maine'}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, letterSpacing: 2, color: '#888', marginBottom: 4 }}>INVOICE</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 14 }}>#{invoice.id}</div>
              <div style={{ fontSize: 10, display: 'grid', gridTemplateColumns: 'auto auto', gap: '2px 14px', textAlign: 'left' }}>
                <span style={{ color: '#888' }}>Date</span><span>{invoice.date || '—'}</span>
                <span style={{ color: '#888' }}>Due</span><span>{invoice.due || '—'}</span>
                <span style={{ color: '#888' }}>Terms</span><span>Due within 14 days</span>
              </div>
              <div style={{
                display: 'inline-block', marginTop: 14, padding: '3px 10px',
                fontSize: 10, fontWeight: 600, letterSpacing: 1,
                background: statusBg, color: statusFg, borderRadius: 3,
              }}>{statusLabel}</div>
            </div>
          </div>

          {/* Bill To + Project */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: 1.5, color: '#888', marginBottom: 8 }}>BILL TO</div>
              <div style={{ fontWeight: 600 }}>{contact?.name || client?.name || '—'}</div>
              <div>{client?.company || ''}</div>
              {client?.address && <div style={{ color: '#555', whiteSpace: 'pre-line' }}>{client.address}</div>}
              {contact?.phone && <div style={{ color: '#555' }}>{contact.phone}</div>}
              {contact?.email && <div style={{ color: '#555' }}>{contact.email}</div>}
            </div>
            <div>
              <div style={{ fontSize: 10, letterSpacing: 1.5, color: '#888', marginBottom: 8 }}>PROJECT</div>
              <div style={{ fontWeight: 600 }}>{invoice.project || '—'}</div>
            </div>
          </div>

          {/* Line Items */}
          <div style={{ fontSize: 10, letterSpacing: 1.5, color: '#888', marginBottom: 8 }}>LINE ITEMS</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #ddd' }}>
                <th style={{ textAlign: 'left', fontSize: 9, letterSpacing: 1, color: '#888', fontWeight: 500, padding: '8px 0' }}>DESCRIPTION</th>
                <th style={{ textAlign: 'right', fontSize: 9, letterSpacing: 1, color: '#888', fontWeight: 500, padding: '8px 0', width: 50 }}>QTY</th>
                <th style={{ textAlign: 'right', fontSize: 9, letterSpacing: 1, color: '#888', fontWeight: 500, padding: '8px 0', width: 80 }}>PRICE</th>
                <th style={{ textAlign: 'right', fontSize: 9, letterSpacing: 1, color: '#888', fontWeight: 500, padding: '8px 0', width: 80 }}>AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {(invoice.items || []).map((item: any, i: number) => (
                <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '10px 0' }}>{item.description || '—'}</td>
                  <td style={{ textAlign: 'right', padding: '10px 0' }}>{item.qty}</td>
                  <td style={{ textAlign: 'right', padding: '10px 0' }}>{money(item.price)}</td>
                  <td style={{ textAlign: 'right', padding: '10px 0' }}>{money(item.qty * item.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 36 }}>
            <div style={{ width: 240, fontSize: 11 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span style={{ color: '#555' }}>Subtotal</span><span>{money(subtotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span style={{ color: '#555' }}>Tax</span><span>{money(tax)}</span>
              </div>
              {shipping > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span style={{ color: '#555' }}>Shipping</span><span>{money(shipping)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 4px', borderTop: '1px solid #ddd', marginTop: 4, fontWeight: 600, fontSize: 13 }}>
                <span>Total Due</span><span>{money(total)}</span>
              </div>
            </div>
          </div>

          {/* Payment Methods */}
          {paymentMethods.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 10, letterSpacing: 1.5, color: '#888', marginBottom: 10 }}>PAYMENT METHODS</div>
              {paymentMethods.map((pm: any, i: number) => (
                <div key={i} style={{ padding: '3px 0' }}>
                  <span style={{ fontWeight: 500 }}>{pm.type}</span>
                  {pm.handle && <span style={{ color: '#555' }}> — {pm.handle}</span>}
                </div>
              ))}
              <div style={{ fontSize: 10, color: '#888', marginTop: 10, fontStyle: 'italic' }}>
                Include #{invoice.id} in your payment note.
              </div>
            </div>
          )}

          {/* Notes */}
          {invoice.notes && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 10, letterSpacing: 1.5, color: '#888', marginBottom: 8 }}>NOTES</div>
              <div style={{ color: '#444', whiteSpace: 'pre-line' }}>{invoice.notes}</div>
            </div>
          )}

          {/* Footer */}
          <div style={{ borderTop: '1px solid #ddd', paddingTop: 12, marginTop: 40, display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#888' }}>
            <span>{(agency.companyName || 'CALO&CO')} · mikecalo.co</span>
            <span>Invoice #{invoice.id}</span>
          </div>
        </div>

        {/* Onscreen-only controls */}
        <div className="ip-no-print" style={{ position: 'fixed', top: 20, right: 20, display: 'flex', gap: 8 }}>
          <button
            onClick={() => window.print()}
            style={{
              padding: '8px 16px', fontSize: 13, fontWeight: 500,
              background: '#0ea5e9', color: 'white', border: 'none',
              borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >Print / Save as PDF</button>
          <button
            onClick={() => window.history.back()}
            style={{
              padding: '8px 16px', fontSize: 13, fontWeight: 500,
              background: 'white', color: '#555', border: '1px solid #ddd',
              borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >Back</button>
        </div>
      </div>
    </>
  );
}
