import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { DB } from '@/lib/database';
import { currency } from '@/lib/utils';

interface FinancialStats {
  monthRevenue: number;
  monthExpenses: number;
  monthNet: number;
  totalRevenue: number;
  totalExpenses: number;
  totalNet: number;
  taxEstimate: number;
  netColor: string;
  monthNetColor: string;
}

function useFinancialStats(): FinancialStats {
  const stats = useMemo(() => {
    const now = new Date();
    const nowMonth = now.getMonth();
    const nowYear = now.getFullYear();

    // This month's invoices (paid only, non-reimbursement)
    const monthInvoices = DB.invoices.filter((i) => {
      if (i.isReimbursement) return false;
      if (i.status !== 'paid') return false;
      try {
        const date = new Date(i.date);
        return date.getMonth() === nowMonth && date.getFullYear() === nowYear;
      } catch {
        return false;
      }
    });

    const monthRevenue = monthInvoices.reduce((sum, i) => {
      const total = (i.items || []).reduce((s, item) => s + item.qty * item.price, 0) + (i.tax || 0) + (i.shipping || 0);
      return sum + total;
    }, 0);

    // This month's expenses
    const monthExpenses = DB.expenses
      .filter((e) => {
        try {
          const date = new Date(e.date);
          return date.getMonth() === nowMonth && date.getFullYear() === nowYear;
        } catch {
          return false;
        }
      })
      .reduce((sum, e) => sum + e.amount, 0);

    const monthNet = monthRevenue - monthExpenses;

    // All-time revenue (paid invoices only, non-reimbursement)
    const totalRevenue = DB.invoices
      .filter((i) => !i.isReimbursement && i.status === 'paid')
      .reduce((sum, i) => {
        const total = (i.items || []).reduce((s, item) => s + item.qty * item.price, 0) + (i.tax || 0) + (i.shipping || 0);
        return sum + total;
      }, 0);

    const totalExpenses = DB.expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalNet = totalRevenue - totalExpenses;

    const taxEstimate = totalNet > 0 ? totalNet * ((DB.agencySettings.taxRate || 28) / 100) : 0;

    // Color coding
    const monthNetColor = monthNet < 0 ? '#dc2626' : monthNet > 0 ? '#16a34a' : '#1a1f2e';
    const netColor = totalNet < 0 ? '#dc2626' : totalNet > 0 ? '#16a34a' : '#1a1f2e';

    return {
      monthRevenue,
      monthExpenses,
      monthNet,
      totalRevenue,
      totalExpenses,
      totalNet,
      taxEstimate,
      netColor,
      monthNetColor,
    };
  }, []);

  return stats;
}

export function FinancialsTileHeader() {
  const stats = useFinancialStats();

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        style={{
          fontSize: '26px',
          fontWeight: '700',
          color: stats.monthNetColor,
          lineHeight: '1.1',
          marginBottom: '2px',
        }}
      >
        {stats.monthNet < 0 ? '−' : ''}
        {currency(Math.abs(stats.monthNet))}
      </div>
      <div style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', marginTop: '2px' }}>
        net this month
      </div>
      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
        {stats.monthRevenue === 0 && stats.monthExpenses === 0
          ? 'No data yet'
          : `${currency(stats.monthRevenue)} revenue · ${currency(stats.monthExpenses)} expenses`}
      </div>
    </div>
  );
}

export function FinancialsTileBody() {
  const router = useRouter();
  const stats = useFinancialStats();

  return (
    <>
      <div className="ag-tile-row">
        <span className="ag-tile-lbl">Gross Revenue</span>
        <span className="ag-tile-val">{currency(stats.totalRevenue)}</span>
      </div>
      <div className="ag-tile-row">
        <span className="ag-tile-lbl">Net Income</span>
        <span
          className={`ag-tile-val ${stats.totalNet < 0 ? 'red' : stats.totalNet > 0 ? 'green' : ''}`}
        >
          {stats.totalNet < 0 ? '−' : ''}
          {currency(Math.abs(stats.totalNet))}
        </span>
      </div>
      <div className="ag-tile-row">
        <span className="ag-tile-lbl">Tax Estimate</span>
        <span className={`ag-tile-val ${stats.taxEstimate > 0 ? 'amber' : ''}`}>{currency(stats.taxEstimate)}</span>
      </div>
      <div className="ag-tile-row">
        <span className="ag-tile-lbl">Expenses</span>
        <span className={`ag-tile-val ${stats.totalExpenses > 0 ? 'red' : ''}`}>
          {currency(stats.totalExpenses)}
        </span>
      </div>
      <span
        className="ag-tile-link"
        onClick={() => router.push('/financials')}
        style={{ cursor: 'pointer' }}
      >
        → View full P&L
      </span>
    </>
  );
}

export default function FinancialsTile() {
  return null; // Not used directly
}
