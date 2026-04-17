'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { loadClients, loadInvoices, deleteInvoice, saveInvoice, DB } from '@/lib/database';
import { agencyStats, currency, invTotal, metricColor } from '@/lib/utils';
import { Invoice } from '@/lib/types';
import { useTheme } from '@/lib/theme';
import HelmSpinner from '@/components/shared/HelmSpinner';
import { motion } from 'framer-motion';

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const fadeUp = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } } };
const spring = { type: 'spring' as const, stiffness: 400, damping: 25 };

export default function AllInvoicesPage() {
  const router = useRouter();
  const { t } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({ billed: 0, paid: 0, outstanding: 0, reimbursed: 0, clients: 0, invoices: 0 });
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        if (DB.clients.length === 0) await loadClients();
        for (const client of DB.clients) {
          if (!DB.invoices.some((i) => i.clientId === client.id)) await loadInvoices(client.id);
        }
        setInvoices(DB.invoices);
        setStats(agencyStats(DB.invoices, DB.clients));
      } catch (e) { console.error('Failed to load invoices:', e); setError('Failed to load invoices'); }
      finally { setIsLoading(false); }
    };
    init();
  }, []);

  const handleDelete = async (invoiceId: string) => {
    try {
      setLoadingId(invoiceId);
      await deleteInvoice(invoiceId);
      setInvoices(DB.invoices);
      setStats(agencyStats(DB.invoices, DB.clients));
      setExpandedId(null);
    } catch (e) { setError('Failed to delete invoice'); }
    finally { setLoadingId(null); }
  };

  const handleStatusChange = async (inv: Invoice, newStatus: string) => {
    inv.status = newStatus as any;
    if (newStatus === 'paid') inv.paidDate = new Date().toISOString().split('T')[0];
    await saveInvoice(inv);
    setInvoices([...DB.invoices]);
    setStats(agencyStats(DB.invoices, DB.clients));
  };

  if (isLoading) return null;

  const shortDate = (d: string) => { if (!d) return '—'; const dt = new Date(d); return isNaN(dt.getTime()) ? d : `${dt.getMonth() + 1}/${dt.getDate()}/${String(dt.getFullYear()).slice(2)}`; };

  const ActionBtn = ({ icon, label, onClick, color }: { icon: React.ReactNode; label: string; onClick: (e: React.MouseEvent) => void; color?: string }) => (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '6px 12px', fontSize: 12, fontWeight: 500, borderRadius: 6,
      border: `1px solid ${t.border.default}`, background: t.bg.surface,
      color: color || t.text.primary, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 150ms',
    }}
    onMouseEnter={(e) => { e.currentTarget.style.background = t.bg.surfaceHover; e.currentTarget.style.borderColor = t.border.hover; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = t.bg.surface; e.currentTarget.style.borderColor = t.border.default; }}
    >{icon}{label}</button>
  );

  const sorted = [...invoices].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const cols = '40px 160px 1fr 1fr 90px 90px 80px 70px 80px 36px';
  const th: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.3px' };

  const statusBadge = (status: string) => {
    const base: React.CSSProperties = { fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4 };
    if (status === 'draft') return (
      <span style={{ ...base, background: t.bg.surfaceHover, color: t.text.secondary }}>
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2v7"/><line x1="9" y1="5" x2="15" y2="5"/><path d="M6 9c0 0 2.5 7 6 7s6-7 6-7"/></svg>
        Draft
      </span>
    );
    if (status === 'paid') return (
      <span style={{ ...base, background: 'rgba(16,185,129,0.08)', color: '#047857' }}>
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 12 9 17 20 6"/></svg>
        Paid
      </span>
    );
    if (status === 'overdue') return (
      <span style={{ ...base, background: 'rgba(239,68,68,0.08)', color: '#dc2626' }}>
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
        Overdue
      </span>
    );
    // unpaid / sent
    return (
      <span style={{ ...base, background: 'rgba(245,158,11,0.08)', color: '#b45309' }}>
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg>
        Sent
      </span>
    );
  };

  return (
    <div style={{ padding: 32, maxWidth: 960 }}>
      <motion.div variants={stagger} initial="hidden" animate="show">

        {/* Header */}
        <motion.div variants={fadeUp} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 400, margin: '0 0 2px', color: t.text.primary }}>Invoices</h1>
            <p style={{ fontSize: 13, color: t.text.tertiary, margin: 0 }}>Track and manage client invoices</p>
          </div>
          <button onClick={() => router.push('/invoices/new')} style={{
            background: t.accent.primary, color: '#fff', border: 'none', borderRadius: 8,
            padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
            transition: 'background 150ms',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = t.accent.primaryHover}
          onMouseLeave={(e) => e.currentTarget.style.background = t.accent.primary}
          >+ New Invoice</button>
        </motion.div>

        {error && <div style={{ padding: '12px 16px', background: `rgba(255,61,61,0.08)`, border: `1px solid rgba(255,61,61,0.2)`, borderRadius: 8, color: t.status.danger, fontSize: 13, marginBottom: 24 }}>{error}</div>}

        {/* Metric tiles */}
        <motion.div variants={fadeUp} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
          {[
            { label: 'Total billed', value: currency(stats.billed), color: t.text.primary },
            { label: 'Outstanding', value: currency(stats.outstanding), color: metricColor(stats.outstanding, t.status.warning, t.text.secondary) },
            { label: 'Collected', value: currency(stats.paid), color: metricColor(stats.paid, t.status.success, t.text.secondary) },
          ].map((m) => (
            <motion.div key={m.label} whileHover={{ y: -1 }} transition={spring} style={{
              background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: t.radius.lg,
              padding: 16, transition: 'border-color 150ms',
            }}
            onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.borderColor = t.border.hover}
            onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.borderColor = t.border.default}
            >
              <div style={{ fontSize: 11, fontWeight: 500, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{m.label}</div>
              <div style={{ fontSize: 28, fontWeight: 500, color: m.color }}>{m.value}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Invoice table */}
        <motion.div variants={fadeUp}>
          <div style={{ background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: cols, padding: '10px 16px', borderBottom: `1px solid ${t.border.default}`, alignItems: 'center' }}>
              <span /><span style={th}>Invoice #</span><span style={th}>Client</span><span style={th}>Project</span><span style={th}>Date</span><span style={th}>Due</span>
              <span style={{ ...th, textAlign: 'right' }}>Amount</span><span style={{ ...th, textAlign: 'center' }}>Status</span><span style={{ ...th, textAlign: 'right' }}>Paid on</span><span />
            </div>

            {sorted.map((inv) => {
              const isExpanded = expandedId === inv.id;
              return (
                <div key={inv.id || inv._uuid}>
                  <div onClick={() => setExpandedId(isExpanded ? null : inv.id)} style={{
                    display: 'grid', gridTemplateColumns: cols, padding: '12px 16px',
                    borderBottom: `1px solid ${t.border.default}`, alignItems: 'center', cursor: 'pointer', transition: 'background 150ms',
                  }}
                  onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = t.bg.surfaceHover}
                  onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.text.tertiary} strokeWidth="2" style={{ transition: 'transform 150ms', transform: isExpanded ? 'rotate(180deg)' : 'none' }}><polyline points="6 9 12 15 18 9"/></svg>
                    <span style={{ fontSize: 13, fontWeight: 500, color: t.text.primary, whiteSpace: 'nowrap' }}>{inv.id}</span>
                    <span style={{ fontSize: 13, color: t.text.secondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(() => { const cl = DB.clients.find(c => c.id === inv.clientId); return cl?.company || cl?.name || '—'; })()}</span>
                    <span style={{ fontSize: 13, color: t.text.secondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.project || '—'}</span>
                    <span style={{ fontSize: 13, color: t.text.secondary }}>{shortDate(inv.date)}</span>
                    <span style={{ fontSize: 13, color: t.text.secondary }}>{shortDate(inv.due)}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: t.text.primary, textAlign: 'right' }}>{currency(invTotal(inv))}</span>
                    <span style={{ textAlign: 'center' }}>{statusBadge(inv.status)}</span>
                    <span style={{ fontSize: 13, color: t.text.secondary, textAlign: 'right' }}>{inv.paidDate || '—'}</span>
                    <span style={{ textAlign: 'center' }}>
                      <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(inv.id); }} disabled={loadingId === inv.id}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: t.text.tertiary, transition: 'color 150ms' }}
                        onMouseEnter={(e) => e.currentTarget.style.color = t.status.danger}
                        onMouseLeave={(e) => e.currentTarget.style.color = t.text.tertiary}
                      ><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                    </span>
                  </div>
                  {isExpanded && (
                    <div style={{ padding: '16px 16px 16px 56px', background: t.bg.surfaceHover, borderBottom: `1px solid ${t.border.default}` }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                        <div>
                          <p style={{ fontSize: 10, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.3px', margin: '0 0 8px' }}>Line items</p>
                          {inv.items?.length ? inv.items.map((item, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `0.5px solid ${t.border.default}`, fontSize: 12 }}>
                              <span style={{ color: t.text.primary }}>{item.description || '—'}</span>
                              <span style={{ color: t.text.secondary, whiteSpace: 'nowrap' }}>{item.qty > 1 ? `${item.qty} × ${currency(item.price)} = ${currency(item.qty * item.price)}` : currency(item.price)}</span>
                            </div>
                          )) : <p style={{ fontSize: 12, color: t.text.tertiary }}>No line items</p>}
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 4px', marginTop: 4, borderTop: `1px solid ${t.border.default}`, fontSize: 11, color: t.text.tertiary }}>
                            <span>
                              {(inv as any).type !== 'reimbursement' && inv.tax > 0 ? `Tax: ${currency(inv.tax)}` : ''}
                              {(inv as any).type !== 'reimbursement' && inv.tax > 0 && inv.shipping > 0 ? ' · ' : ''}
                              {inv.shipping > 0 ? `Shipping: ${currency(inv.shipping)}` : ''}
                            </span>
                            <span style={{ fontWeight: 600, color: t.text.primary, fontSize: 13 }}>Total: {currency((inv as any).type === 'reimbursement' ? invTotal(inv) - (inv.tax || 0) : invTotal(inv))}</span>
                          </div>
                        </div>
                        <div>
                          {inv.notes && (<><p style={{ fontSize: 10, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.3px', margin: '0 0 8px' }}>Notes</p><p style={{ fontSize: 12, color: t.text.secondary, lineHeight: 1.4, margin: 0 }}>{inv.notes}</p></>)}
                          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                            <ActionBtn icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>} label="Edit" onClick={(e) => { e.stopPropagation(); router.push(`/invoices/new?edit=${inv._uuid || inv.id}`); }} />
                            <ActionBtn icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>} label="Preview" onClick={(e) => { e.stopPropagation(); window.open(`/invoices/${inv.id}/print`, '_blank'); }} />
                            <ActionBtn icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>} label="Download" onClick={async (e) => {
                              e.stopPropagation();
                              const iframe = document.createElement('iframe');
                              iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:816px;height:1056px;border:none';
                              document.body.appendChild(iframe);
                              iframe.src = `/invoices/${inv.id}/print?silent=1`;
                              iframe.onload = async () => {
                                try {
                                  await new Promise(r => setTimeout(r, 800));
                                  const el = iframe.contentDocument?.querySelector('.ip-invoice-content');
                                  if (!el) { document.body.removeChild(iframe); return; }
                                  const html2pdf = (await import('html2pdf.js' as any)).default;
                                  await html2pdf().set({ margin: [0.4, 0.4, 0.6, 0.4], filename: `${inv.id}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' }, jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } }).from(el as HTMLElement).save();
                                } catch (err) { console.error('[Download] PDF failed:', err); }
                                finally { document.body.removeChild(iframe); }
                              };
                            }} />
                            {(inv.status === 'draft' || inv.status === 'unpaid') && (
                              <ActionBtn icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 12 9 17 20 6"/></svg>} label={inv.status === 'draft' ? 'Mark Sent' : 'Mark Paid'} color={t.status.success} onClick={(e) => { e.stopPropagation(); handleStatusChange(inv, inv.status === 'draft' ? 'unpaid' : 'paid'); }} />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {sorted.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: t.text.tertiary, fontSize: 13 }}>No invoices yet</div>}
          </div>
        </motion.div>
      </motion.div>

      <ConfirmModal isOpen={!!deleteTarget} title="Delete invoice" message="This cannot be undone." confirmLabel="Delete" destructive
        onConfirm={() => { if (deleteTarget) handleDelete(deleteTarget); setDeleteTarget(null); }} onCancel={() => setDeleteTarget(null)} />
    </div>
  );
}
