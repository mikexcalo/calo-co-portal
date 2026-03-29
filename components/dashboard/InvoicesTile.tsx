import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { DB } from '@/lib/database';
import { currency, daysUntil } from '@/lib/utils';

interface InvoiceStats {
  totalCount: number;
  outstanding: number;
  paid: number;
  overdueCount: number;
  recentInvoice?: any;
  heroColor: string;
  subtext: string;
}

function useInvoiceStats(): InvoiceStats {
  const stats = useMemo(() => {
    const invoices = DB.invoices.filter((i) => !i.isReimbursement);

    const allOutstanding = invoices
      .filter((i) => i.status !== 'paid')
      .reduce((sum, i) => {
        const total = (i.items || []).reduce((s, item) => s + item.qty * item.price, 0) + (i.tax || 0) + (i.shipping || 0);
        return sum + total;
      }, 0);

    const allPaid = invoices
      .filter((i) => i.status === 'paid')
      .reduce((sum, i) => {
        const total = (i.items || []).reduce((s, item) => s + item.qty * item.price, 0) + (i.tax || 0) + (i.shipping || 0);
        return sum + total;
      }, 0);

    const overdueCount = invoices.filter((i) => i.status !== 'paid' && daysUntil(i.due)! < 0).length;

    const heroColor = allOutstanding === 0 ? '#16a34a' : '#d97706';
    const subtext =
      invoices.length === 0
        ? 'No invoices yet'
        : `${invoices.length} invoice${invoices.length !== 1 ? 's' : ''}${
            overdueCount > 0 ? ` · ${overdueCount} overdue` : ' · 0 overdue'
          }`;

    const recentInvoice = DB.invoices.length > 0
      ? [...DB.invoices].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
      : null;

    return {
      totalCount: invoices.length,
      outstanding: allOutstanding,
      paid: allPaid,
      overdueCount,
      recentInvoice,
      heroColor,
      subtext,
    };
  }, []);

  return stats;
}

export function InvoicesTileHeader() {
  const stats = useInvoiceStats();

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        style={{
          fontSize: '26px',
          fontWeight: '700',
          color: stats.heroColor,
          lineHeight: '1.1',
          marginBottom: '2px',
        }}
      >
        {currency(stats.outstanding)}
      </div>
      <div style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', marginTop: '2px' }}>
        outstanding
      </div>
      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
        {stats.subtext}
      </div>
    </div>
  );
}

export function InvoicesTileBody() {
  const router = useRouter();
  const stats = useInvoiceStats();

  return (
    <>
      <div className="ag-tile-row">
        <span className="ag-tile-lbl">Total</span>
        <span className="ag-tile-val">
          {stats.totalCount} invoice{stats.totalCount !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="ag-tile-row">
        <span className="ag-tile-lbl">Outstanding</span>
        <span className={`ag-tile-val ${stats.outstanding > 0 ? 'amber' : ''}`}>
          {currency(stats.outstanding)}
        </span>
      </div>
      <div className="ag-tile-row">
        <span className="ag-tile-lbl">Paid</span>
        <span className="ag-tile-val green">{currency(stats.paid)}</span>
      </div>
      {stats.recentInvoice && (
        <div className="ag-tile-recent">
          {stats.recentInvoice.project} —{' '}
          <span style={{ color: stats.recentInvoice.status === 'paid' ? '#16a34a' : '#b45309', fontWeight: '600' }}>
            {stats.recentInvoice.status === 'paid' ? 'Paid' : 'Unpaid'}
          </span>
        </div>
      )}
      <span
        className="ag-tile-link"
        onClick={() => router.push('/invoices')}
        style={{ cursor: 'pointer' }}
      >
        → View all invoices
      </span>
    </>
  );
}

export default function InvoicesTile() {
  return null; // Not used directly
}
