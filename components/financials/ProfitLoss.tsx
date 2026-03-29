'use client';

import { DB } from '@/lib/database';
import { currency, invTotal } from '@/lib/utils';

const CAT_LABELS: Record<string, string> = {
  contractor: 'Contractor',
  software: 'Software',
  materials: 'Materials',
  travel: 'Travel',
  other: 'Other',
};

interface ProfitLossProps {
  period: 'month' | 'quarter' | 'year' | 'all';
  clientId?: string;
}

export default function ProfitLoss({ period, clientId }: ProfitLossProps) {
  const getPeriodDates = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    switch (period) {
      case 'month': {
        const start = new Date(year, month, 1);
        const end = new Date(year, month + 1, 0);
        return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
      }
      case 'quarter': {
        const q = Math.floor(month / 3);
        const start = new Date(year, q * 3, 1);
        const end = new Date(year, q * 3 + 3, 0);
        return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
      }
      case 'year': {
        const start = new Date(year, 0, 1);
        const end = new Date(year, 11, 31);
        return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
      }
      default:
        return { start: '2000-01-01', end: '2099-12-31' };
    }
  };

  const { start, end } = getPeriodDates();

  const scopedInvoices = clientId
    ? DB.invoices.filter((i) => i.clientId === clientId)
    : DB.invoices;
  const scopedExpenses = clientId
    ? DB.expenses.filter((e) => e.clientId === clientId)
    : DB.expenses;

  const svcInvs = scopedInvoices.filter(
    (i) => !i.isReimbursement && i.date >= start && i.date <= end
  );
  const ptInvs = scopedInvoices.filter(
    (i) => i.isReimbursement && i.date >= start && i.date <= end
  );

  const svcRevenue = svcInvs.reduce((sum, i) => sum + invTotal(i), 0);
  const ptRevenue = ptInvs.reduce((sum, i) => sum + invTotal(i), 0);
  const grossRevenue = svcRevenue + ptRevenue;

  const periodExp = scopedExpenses.filter((e) => e.date >= start && e.date <= end);
  const totalExpenses = periodExp.reduce((sum, e) => sum + e.amount, 0);

  const netIncome = svcRevenue - totalExpenses;
  const taxRate = (DB.agencySettings.taxRate || 28) / 100;
  const taxEst = netIncome > 0 ? netIncome * taxRate : 0;
  const takeHome = netIncome - taxEst;

  const expByCat: Record<string, number> = {};
  periodExp.forEach((e) => {
    const c = e.category || 'other';
    if (!expByCat[c]) expByCat[c] = 0;
    expByCat[c] += e.amount;
  });

  return (
    <div className="space-y-4">
      {/* Revenue Section */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-600 uppercase mb-3">Revenue</div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">Service Revenue</span>
          <span className="font-mono text-slate-900">{currency(svcRevenue)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">Pass-Through Revenue</span>
          <span className="font-mono text-slate-900">{currency(ptRevenue)}</span>
        </div>
        <div className="flex justify-between text-sm font-bold border-t border-slate-200 pt-2">
          <span className="text-slate-900">Total Revenue</span>
          <span className="font-mono text-slate-900">{currency(grossRevenue)}</span>
        </div>
      </div>

      {/* Expenses Section */}
      <div className="space-y-2 mt-6 pt-4 border-t border-slate-200">
        <div className="text-xs font-semibold text-slate-600 uppercase mb-3">Expenses</div>
        {Object.keys(CAT_LABELS).length > 0 ? (
          <>
            {Object.entries(CAT_LABELS).map(([cat, label]) =>
              expByCat[cat] ? (
                <div key={cat} className="flex justify-between text-sm">
                  <span className="text-slate-600">{label}</span>
                  <span className="font-mono text-red-600">−{currency(expByCat[cat])}</span>
                </div>
              ) : null
            )}
            {Object.keys(expByCat).length === 0 && (
              <div className="text-sm text-slate-400 italic">No expenses logged</div>
            )}
          </>
        ) : (
          <div className="text-sm text-slate-400 italic">No expenses logged</div>
        )}
        <div className="flex justify-between text-sm font-bold border-t border-slate-200 pt-2">
          <span className="text-slate-900">Total Expenses</span>
          <span className={`font-mono ${totalExpenses > 0 ? 'text-red-600' : 'text-slate-900'}`}>
            {totalExpenses > 0 ? '−' : ''}{currency(totalExpenses)}
          </span>
        </div>
      </div>

      {/* Net Income */}
      <div className="flex justify-between text-sm font-bold border-t-2 border-slate-900 pt-4 mt-6">
        <span className="text-slate-900">Net Income</span>
        <span className={`font-mono ${netIncome < 0 ? 'text-red-600' : 'text-slate-900'}`}>
          {netIncome < 0 ? '−' : ''}{currency(Math.abs(netIncome))}
        </span>
      </div>

      {/* Tax */}
      <div className="flex justify-between text-sm text-slate-600">
        <span>Federal + State Tax Est. ({DB.agencySettings.taxRate || 28}%)</span>
        <span className="font-mono text-red-600">−{currency(taxEst)}</span>
      </div>

      {/* Take Home */}
      <div className="flex justify-between text-sm font-bold text-green-700">
        <span>Estimated Take-Home</span>
        <span className="font-mono">{currency(takeHome > 0 ? takeHome : 0)}</span>
      </div>
    </div>
  );
}
