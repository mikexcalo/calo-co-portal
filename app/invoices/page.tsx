'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ConfirmModal from '@/components/shared/ConfirmModal';
import {
  loadClients,
  loadInvoices,
  deleteInvoice,
  DB,
} from '@/lib/database';
import { agencyStats, currency, invTotal } from '@/lib/utils';
import { Invoice } from '@/lib/types';
import { colors } from '@/lib/design-tokens';
import { PageLayout, MetricCard } from '@/components/shared/PageLayout';

export default function AllInvoicesPage() {
  const router = useRouter();
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
        if (DB.clients.length === 0) {
          await loadClients();
        }

        // Load invoices for all clients
        for (const client of DB.clients) {
          const existing = DB.invoices.filter((i) => i.clientId === client.id).length;
          if (existing === 0) {
            await loadInvoices(client.id);
          }
        }

        setInvoices(DB.invoices);
        setStats(agencyStats(DB.invoices, DB.clients));
      } catch (e) {
        console.error('Failed to load invoices:', e);
        setError('Failed to load invoices');
      } finally {
        setIsLoading(false);
      }
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
    } catch (e) {
      console.error('Failed to delete invoice:', e);
      setError('Failed to delete invoice');
    } finally {
      setLoadingId(null);
    }
  };

  if (isLoading) {
    return <div style={{ padding: '32px 40px', color: '#6b7280', fontSize: 13 }}>Loading invoices...</div>;
  }

  const sorted = [...invoices].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const cols = '40px 80px 1fr 90px 90px 80px 70px 80px 36px';
  const thStyle: React.CSSProperties = { fontSize: '10px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.3px' };

  return (
    <PageLayout
      title="All Invoices"
      subtitle="Track and manage client invoices"
      action={
        <button
          onClick={() => router.push('/clients')}
          style={{
            background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8,
            padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit',
          }}
        >
          + New Invoice
        </button>
      }
    >
      {error && (
        <div style={{ padding: '12px 16px', background: colors.red.bg, border: `1px solid ${colors.red.border}`, borderRadius: 6, color: colors.red.accent, fontSize: 13, marginBottom: 24 }}>
          {error}
        </div>
      )}

      {/* Metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 24 }}>
        <MetricCard label="Total billed" value={currency(stats.billed)} />
        <MetricCard label="Outstanding" value={currency(stats.outstanding)} color="#D97706" />
        <MetricCard label="Collected" value={currency(stats.paid)} color="#16a34a" />
      </div>

      {/* Invoice table */}
      <div style={{ background: '#ffffff', border: '0.5px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
        {/* Header row */}
        <div style={{ display: 'grid', gridTemplateColumns: cols, padding: '10px 16px', background: '#f9fafb', borderBottom: '0.5px solid #e5e7eb', alignItems: 'center' }}>
          <span />
          <span style={thStyle}>Invoice #</span>
          <span style={thStyle}>Project</span>
          <span style={thStyle}>Date</span>
          <span style={thStyle}>Due</span>
          <span style={{ ...thStyle, textAlign: 'right' }}>Amount</span>
          <span style={{ ...thStyle, textAlign: 'center' }}>Status</span>
          <span style={{ ...thStyle, textAlign: 'right' }}>Paid on</span>
          <span />
        </div>

        {/* Data rows */}
        {sorted.map((inv) => {
          const isExpanded = expandedId === inv.id;
          return (
            <div key={inv.id || inv._uuid}>
              <div
                style={{
                  display: 'grid', gridTemplateColumns: cols,
                  padding: '12px 16px', borderBottom: '0.5px solid #f1f3f5',
                  alignItems: 'center', cursor: 'pointer',
                }}
                onClick={() => setExpandedId(isExpanded ? null : inv.id)}
              >
                {/* Chevron */}
                <span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"
                    style={{ transition: 'transform 150ms', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </span>
                <span style={{ fontSize: 12, fontWeight: 500, color: '#111827' }}>{inv.id}</span>
                <span style={{ fontSize: 12, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.project || '—'}</span>
                <span style={{ fontSize: 12, color: '#6b7280' }}>{inv.date}</span>
                <span style={{ fontSize: 12, color: '#6b7280' }}>{inv.due}</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: '#111827', textAlign: 'right' }}>{currency(invTotal(inv))}</span>
                <span style={{ textAlign: 'center' }}>
                  <span style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 10,
                    background: inv.status === 'paid' ? '#ECFDF5' : inv.status === 'overdue' ? '#FEF2F2' : '#FFFBEB',
                    color: inv.status === 'paid' ? '#065F46' : inv.status === 'overdue' ? '#991B1B' : '#92400E',
                  }}>
                    {inv.status === 'paid' ? 'Paid' : inv.status === 'overdue' ? 'Overdue' : 'Unpaid'}
                  </span>
                </span>
                <span style={{ fontSize: 12, color: '#6b7280', textAlign: 'right' }}>{inv.paidDate || '—'}</span>
                {/* Delete */}
                <span style={{ textAlign: 'center' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(inv.id); }}
                    disabled={loadingId === inv.id}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#cbd5e1', opacity: 0.5 }}
                    title="Delete"
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.opacity = '1'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#cbd5e1'; e.currentTarget.style.opacity = '0.5'; }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </span>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div style={{ padding: '16px 16px 16px 56px', background: '#f9fafb', borderBottom: '0.5px solid #e5e7eb' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    {/* Line items */}
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.3px', margin: '0 0 8px' }}>Line items</p>
                      {inv.items && inv.items.length > 0 ? (
                        <div style={{ fontSize: 12 }}>
                          {inv.items.map((item, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '0.5px solid #e5e7eb' }}>
                              <span style={{ color: '#111827' }}>{item.description || '—'}</span>
                              <span style={{ color: '#6b7280', whiteSpace: 'nowrap' }}>{item.qty} × {currency(item.price)} = {currency(item.qty * item.price)}</span>
                            </div>
                          ))}
                          {(inv.tax > 0 || inv.shipping > 0) && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 11, color: '#9ca3af' }}>
                              <span>{inv.tax > 0 ? `Tax: ${currency(inv.tax)}` : ''}{inv.tax > 0 && inv.shipping > 0 ? ' · ' : ''}{inv.shipping > 0 ? `Shipping: ${currency(inv.shipping)}` : ''}</span>
                              <span style={{ fontWeight: 500, color: '#111827' }}>Total: {currency(invTotal(inv))}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p style={{ fontSize: 12, color: '#9ca3af' }}>No line items</p>
                      )}
                    </div>
                    {/* Notes */}
                    <div>
                      {inv.notes && (
                        <>
                          <p style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.3px', margin: '0 0 8px' }}>Notes</p>
                          <p style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.4, margin: 0 }}>{inv.notes}</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Empty state */}
        {sorted.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
            No invoices yet
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Delete invoice"
        message="This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => { if (deleteTarget) handleDelete(deleteTarget); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
      />
    </PageLayout>
  );
}
