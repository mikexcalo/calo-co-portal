'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { DB, loadInvoices, loadExpenses } from '@/lib/database';
import { Client, Invoice, Expense } from '@/lib/types';
import { currency, invTotal } from '@/lib/utils';

export default function ClientFinancialsPage() {
  const params = useParams();
  const clientId = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year' | 'all'>('month');

  useEffect(() => {
    const foundClient = DB.clients.find((c) => c.id === clientId);
    setClient(foundClient || null);

    if (foundClient) {
      loadInvoices(clientId);
      loadExpenses();

      setInvoices(DB.invoices.filter((i) => i.clientId === clientId));
      setExpenses(DB.expenses.filter((e) => e.clientId === clientId));
    }
  }, [clientId]);

  if (!client) {
    return (
      <div className="page">
        <div className="text-center py-12">
          <p className="text-slate-500">Client not found</p>
        </div>
      </div>
    );
  }

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

  const filteredInvoices = invoices.filter(
    (i) => !i.isReimbursement && i.date >= start && i.date <= end
  );
  const filteredExpenses = expenses.filter((e) => e.date >= start && e.date <= end);

  const totalBilled = filteredInvoices.reduce((sum, i) => sum + invTotal(i), 0);
  const totalPaid = filteredInvoices
    .filter((i) => i.status === 'paid')
    .reduce((sum, i) => sum + invTotal(i), 0);
  const outstanding = totalBilled - totalPaid;
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  const periodLabel =
    period === 'month' ? 'This Month' : period === 'quarter' ? 'This Quarter' : period === 'year' ? 'This Fiscal Year' : 'All Time';

  return (
    <div className="page">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">{client.company || client.name}</h1>
        <p className="text-sm text-slate-500">Financial summary for this client</p>

        {/* Period Selector */}
        <div className="flex gap-2 mt-4">
          {(['month', 'quarter', 'year', 'all'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition ${
                period === p
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'border-slate-300 text-slate-700 hover:border-slate-400'
              }`}
            >
              {p === 'month' ? 'Month' : p === 'quarter' ? 'Quarter' : p === 'year' ? 'Year' : 'All Time'}
            </button>
          ))}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Billed" value={currency(totalBilled)} sub={`${filteredInvoices.length} invoice${filteredInvoices.length !== 1 ? 's' : ''}`} />
        <StatCard label="Paid" value={currency(totalPaid)} sub={`${filteredInvoices.filter((i) => i.status === 'paid').length} paid`} />
        <StatCard label="Outstanding" value={currency(outstanding)} sub={`${filteredInvoices.filter((i) => i.status !== 'paid').length} unpaid`} />
        <StatCard label="Expenses" value={currency(totalExpenses)} sub={`${filteredExpenses.length} expense${filteredExpenses.length !== 1 ? 's' : ''}`} />
      </div>

      {/* Invoices Table */}
      {filteredInvoices.length > 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden mb-8">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-900">Invoices — {periodLabel}</h2>
          </div>
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">Invoice</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600">Date</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600">Status</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map((inv) => (
                <tr key={inv.id} className="border-b border-slate-200 hover:bg-slate-50">
                  <td className="px-6 py-3 text-sm font-medium text-indigo-600">
                    #{inv.id}
                    {inv.project ? ` — ${inv.project}` : ''}
                  </td>
                  <td className="px-6 py-3 text-sm text-slate-600 text-right font-mono">{inv.date}</td>
                  <td className="px-6 py-3 text-right">
                    <span
                      className={`inline-block px-3 py-1 text-xs font-medium rounded-full border ${
                        inv.status === 'paid'
                          ? 'bg-green-50 border-green-300 text-green-700'
                          : 'bg-amber-50 border-amber-300 text-amber-900'
                      }`}
                    >
                      {inv.status === 'paid' ? 'Paid' : 'Unpaid'}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right text-sm font-bold text-slate-900">
                    {currency(invTotal(inv))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center text-slate-500 text-sm mb-8">
          No invoices in this period.
        </div>
      )}

      {/* Expenses List */}
      {filteredExpenses.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-900">Expenses — {periodLabel}</h2>
          </div>
          <div className="divide-y divide-slate-200">
            {filteredExpenses.map((exp) => (
              <div key={exp.id} className="p-6 hover:bg-slate-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900">{exp.vendor || exp.description || 'Expense'}</div>
                    {exp.description && <div className="text-xs text-slate-500 mt-1">{exp.description}</div>}
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500 mb-2">{exp.date}</div>
                    <div className="text-sm font-bold text-red-600">−{currency(exp.amount)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="text-xs font-semibold text-slate-600 mb-2">{label}</div>
      <div className="text-2xl font-bold text-slate-900 mb-1">{value}</div>
      <div className="text-xs text-slate-500">{sub}</div>
    </div>
  );
}
