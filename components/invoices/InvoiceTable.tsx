'use client';

import { useState } from 'react';
import { Invoice, InvoiceItem } from '@/lib/types';
import { currency, invTotal, statusPillClass, getStatusLabel } from '@/lib/utils';
import styles from './InvoiceTable.module.css';

interface InvoiceTableProps {
  invoices: Invoice[];
  onDelete?: (invoiceId: string) => Promise<void>;
  onMarkPaid?: (invoiceId: string) => Promise<void>;
  showDelete?: boolean;
  isAgencyView?: boolean;
}

export default function InvoiceTable({
  invoices,
  onDelete,
  onMarkPaid,
  showDelete = false,
  isAgencyView = false,
}: InvoiceTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleToggle = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleMarkPaid = async (invoiceId: string) => {
    if (!onMarkPaid) return;
    try {
      setLoadingId(invoiceId);
      await onMarkPaid(invoiceId);
      setExpandedId(null);
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (invoiceId: string) => {
    if (!onDelete || !confirm('Delete this invoice?')) return;
    try {
      setLoadingId(invoiceId);
      await onDelete(invoiceId);
    } finally {
      setLoadingId(null);
    }
  };

  const sortedInvoices = [...invoices].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.toggleCol}></th>
            <th>Invoice #</th>
            <th>Project</th>
            <th>Date</th>
            <th>Due</th>
            <th className={styles.amountCol}>Amount</th>
            <th>Status</th>
            <th>Paid On</th>
            {showDelete && <th className={styles.actionCol}></th>}
          </tr>
        </thead>
        <tbody>
          {sortedInvoices.map((inv) => (
            <tbody key={inv.id}>
              <tr className={styles.row}>
                <td className={styles.toggleCol}>
                  <button
                    className={styles.toggleBtn}
                    onClick={() => handleToggle(inv.id)}
                    title="Expand details"
                  >
                    <svg className={styles.chevron} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                </td>
                <td className={styles.invoiceNum}>{inv.id}</td>
                <td>{inv.project || '—'}</td>
                <td>{inv.date}</td>
                <td>{inv.due}</td>
                <td className={styles.amountCol}>{currency(invTotal(inv))}</td>
                <td>
                  <span className={statusPillClass(inv.status)}>
                    {getStatusLabel(inv.status)}
                  </span>
                </td>
                <td>{inv.paidDate || '—'}</td>
                {showDelete && (
                  <td className={styles.actionCol}>
                    <button
                      className={styles.deleteIconBtn}
                      onClick={() => handleDelete(inv.id)}
                      disabled={loadingId === inv.id}
                      title="Delete invoice"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <line x1="10" y1="11" x2="10" y2="17" />
                        <line x1="14" y1="11" x2="14" y2="17" />
                      </svg>
                    </button>
                  </td>
                )}
              </tr>
              {expandedId === inv.id && (
                <tr className={styles.expandRow}>
                  <td colSpan={showDelete ? 9 : 8}>
                    <div className={styles.expandContent}>
                      <div className={styles.itemsSection}>
                        <h4 className={styles.sectionTitle}>Line Items</h4>
                        <table className={styles.itemsTable}>
                          <thead>
                            <tr>
                              <th>Item</th>
                              <th className={styles.narrow}>Qty</th>
                              <th className={styles.narrow}>Price</th>
                              <th className={`${styles.narrow} ${styles.right}`}>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {inv.items && inv.items.length > 0 ? (
                              inv.items.map((item, idx) => (
                                <tr key={idx}>
                                  <td>{item.description || '—'}</td>
                                  <td className={styles.narrow}>{item.qty}</td>
                                  <td className={styles.narrow}>{currency(item.price)}</td>
                                  <td className={`${styles.narrow} ${styles.right}`}>
                                    {currency(item.qty * item.price)}
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={4} style={{ textAlign: 'center', color: '#9ca3af' }}>
                                  No items
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      <div className={styles.actionsSection}>
                        <h4 className={styles.sectionTitle}>Actions</h4>
                        <div className={styles.actions}>
                          {inv.status !== 'paid' && onMarkPaid && (
                            <button
                              className={styles.actionBtn}
                              onClick={() => handleMarkPaid(inv.id)}
                              disabled={loadingId === inv.id}
                            >
                              {loadingId === inv.id ? 'Marking...' : 'Mark Paid'}
                            </button>
                          )}
                          {inv.status === 'paid' && inv.paidDate && (
                            <div style={{ fontSize: '12px', color: '#6b7280' }}>
                              Paid on {inv.paidDate}
                            </div>
                          )}
                          {inv.notes && (
                            <div className={styles.notes}>
                              <strong>Notes:</strong> {inv.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          ))}
        </tbody>
      </table>
      {sortedInvoices.length === 0 && (
        <div className={styles.empty}>No invoices yet</div>
      )}
    </div>
  );
}
