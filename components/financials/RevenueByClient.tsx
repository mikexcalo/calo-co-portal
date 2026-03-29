'use client';

import { DB } from '@/lib/database';
import { currency, invTotal } from '@/lib/utils';

interface RevenueByClientProps {
  period: 'month' | 'quarter' | 'year' | 'all';
}

export default function RevenueByClient({ period }: RevenueByClientProps) {
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

  const svcInvs = DB.invoices.filter(
    (i) => !i.isReimbursement && i.date >= start && i.date <= end
  );

  const grossRevenue = svcInvs.reduce((sum, i) => sum + invTotal(i), 0);

  // Group revenue by client
  const revByClient: Record<string, { total: number; paid: number; count: number }> = {};
  svcInvs.forEach((i) => {
    if (!revByClient[i.clientId]) {
      revByClient[i.clientId] = { total: 0, paid: 0, count: 0 };
    }
    revByClient[i.clientId].total += invTotal(i);
    if (i.status === 'paid') {
      revByClient[i.clientId].paid += invTotal(i);
    }
    revByClient[i.clientId].count += 1;
  });

  const clients = Object.entries(revByClient).sort((a, b) => b[1].total - a[1].total);

  const periodLabel =
    period === 'month' ? 'This Month' : period === 'quarter' ? 'This Quarter' : period === 'year' ? 'This Fiscal Year' : 'All Time';

  if (clients.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-12 text-center text-slate-500 text-sm">
        No service revenue in this period.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-200">
        <h2 className="text-lg font-bold text-slate-900">Revenue by Client — {periodLabel}</h2>
      </div>
      <table className="w-full">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">Client</th>
            <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600">Invoices</th>
            <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600">Collected</th>
            <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600">Total</th>
            <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600">% of Rev</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {clients.map(([clientId, stats]) => {
            const client = DB.clients.find((c) => c.id === clientId);
            if (!client) return null;

            const pct = grossRevenue > 0 ? `${((stats.total / grossRevenue) * 100).toFixed(0)}%` : '—';

            return (
              <tr key={clientId} className="hover:bg-slate-50">
                <td className="px-6 py-4 text-sm font-medium text-indigo-600 cursor-pointer hover:text-indigo-700">
                  {client.company || client.name}
                </td>
                <td className="px-6 py-4 text-right text-sm font-mono text-slate-600">
                  {stats.count}
                </td>
                <td className="px-6 py-4 text-right text-sm font-mono text-slate-600">
                  {currency(stats.paid)}
                </td>
                <td className="px-6 py-4 text-right text-sm font-bold font-mono text-slate-900">
                  {currency(stats.total)}
                </td>
                <td className="px-6 py-4 text-right text-sm text-slate-500">
                  {pct}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
