'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DB, loadInvoices, loadExpenses, saveExpense } from '@/lib/database';
import { Client, Invoice, Expense } from '@/lib/types';
import { currency, invTotal } from '@/lib/utils';

const CAT_LABELS: Record<string, string> = {
  contractor: 'Contractor',
  software: 'Software',
  materials: 'Materials',
  travel: 'Travel',
  other: 'Other',
};

type Period = 'month' | 'quarter' | 'year' | 'all';

export default function ClientFinancialsPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [period, setPeriod] = useState<Period>('month');
  const [showLogExpense, setShowLogExpense] = useState(false);
  const [expForm, setExpForm] = useState<Partial<Expense>>({
    date: new Date().toISOString().split('T')[0],
    category: 'other',
  });
  const [saving, setSaving] = useState(false);

  const taxRate = DB.agencySettings.taxRate || 28;

  const refreshData = useCallback(() => {
    setInvoices(DB.invoices.filter((i) => i.clientId === clientId));
    setExpenses(DB.expenses.filter((e) => e.clientId === clientId));
  }, [clientId]);

  useEffect(() => {
    const init = async () => {
      const foundClient = DB.clients.find((c) => c.id === clientId);
      setClient(foundClient || null);

      if (foundClient) {
        await loadInvoices(clientId);
        await loadExpenses().catch((e) => console.warn('[client-financials] loadExpenses failed:', e));
        refreshData();
      }
    };
    init();
  }, [clientId, refreshData]);

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

  // Stat card values
  const grossRevenue = filteredInvoices
    .filter((i) => i.status === 'paid')
    .reduce((sum, i) => sum + invTotal(i), 0);
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const netIncome = grossRevenue - totalExpenses;
  const taxEstimate = netIncome > 0 ? netIncome * (taxRate / 100) : 0;

  const periodLabel =
    period === 'month'
      ? 'This Month'
      : period === 'quarter'
      ? 'This Quarter'
      : period === 'year'
      ? 'This Fiscal Year'
      : 'All Time';

  const handleLogExpense = async () => {
    if (!expForm.date || !expForm.amount || expForm.amount <= 0) {
      alert('Please fill in date and amount');
      return;
    }

    setSaving(true);
    const newExp: Expense = {
      date: expForm.date,
      category: expForm.category || 'other',
      vendor: expForm.vendor || '',
      description: expForm.description || '',
      amount: expForm.amount,
      clientId: clientId,
      notes: expForm.notes || '',
    };

    const saved = await saveExpense(newExp);
    if (saved) {
      DB.expenses.unshift({ ...newExp, id: saved.id });
    }

    refreshData();
    setShowLogExpense(false);
    setExpForm({ date: new Date().toISOString().split('T')[0], category: 'other' });
    setSaving(false);
  };

  const statusPill = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-50 border-green-300 text-green-700';
      case 'draft':
        return 'bg-slate-50 border-slate-300 text-slate-600';
      default:
        return 'bg-amber-50 border-amber-300 text-amber-900';
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'paid':
        return 'Paid';
      case 'draft':
        return 'Draft';
      default:
        return 'Outstanding';
    }
  };

  return (
    <div className="page">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-1">
              {client.company || client.name} — Financials
            </h1>
            <p className="text-sm text-slate-500">Client revenue and expense tracking</p>
          </div>
        </div>

        {/* Period Selector */}
        <div className="flex gap-2">
          {(['month', 'quarter', 'year', 'all'] as Period[]).map((p) => (
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
        <StatCard
          label="Gross Revenue"
          value={currency(grossRevenue)}
          sub={`${filteredInvoices.filter((i) => i.status === 'paid').length} paid invoice${filteredInvoices.filter((i) => i.status === 'paid').length !== 1 ? 's' : ''}`}
        />
        <StatCard
          label="Total Expenses"
          value={currency(totalExpenses)}
          sub={`${filteredExpenses.length} expense${filteredExpenses.length !== 1 ? 's' : ''}`}
        />
        <StatCard
          label="Net Income"
          value={currency(netIncome)}
          sub="Before tax"
        />
        <StatCard
          label={`Tax Estimate (${taxRate}%)`}
          value={currency(taxEstimate)}
          sub={`Take-home: ${currency(netIncome - taxEstimate)}`}
        />
      </div>

      {/* Revenue Section — Invoice Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden mb-8">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">Revenue — {periodLabel}</h2>
        </div>
        {filteredInvoices.length > 0 ? (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">Invoice #</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">Date</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">Status</th>
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
                  <td className="px-6 py-3 text-sm text-slate-600 font-mono">{inv.date}</td>
                  <td className="px-6 py-3">
                    <span
                      className={`inline-block px-3 py-1 text-xs font-medium rounded-full border ${statusPill(inv.status)}`}
                    >
                      {statusLabel(inv.status)}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right text-sm font-bold text-slate-900">
                    {currency(invTotal(inv))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-12 text-center text-slate-500 text-sm">
            No invoices in this period.
          </div>
        )}
      </div>

      {/* Expenses Section */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Expenses — {periodLabel}</h2>
          <button
            onClick={() => setShowLogExpense(true)}
            className="btn btn-ghost btn-sm text-xs"
          >
            + Log Expense
          </button>
        </div>

        {/* Log Expense Modal */}
        {showLogExpense && (
          <div className="bg-slate-50 border-b border-slate-200 p-6 space-y-3">
            <div className="font-semibold text-slate-900 text-sm">Log New Expense</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Date</label>
                <input
                  type="date"
                  value={expForm.date || ''}
                  onChange={(e) => setExpForm({ ...expForm, date: e.target.value })}
                  className="form-input w-full text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={expForm.amount || ''}
                  onChange={(e) => setExpForm({ ...expForm, amount: parseFloat(e.target.value) || 0 })}
                  className="form-input w-full text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Category</label>
                <select
                  value={expForm.category || 'other'}
                  onChange={(e) => setExpForm({ ...expForm, category: e.target.value })}
                  className="form-input w-full text-sm"
                >
                  {Object.entries(CAT_LABELS).map(([cat, label]) => (
                    <option key={cat} value={cat}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Vendor</label>
                <input
                  type="text"
                  placeholder="Vendor / payee"
                  value={expForm.vendor || ''}
                  onChange={(e) => setExpForm({ ...expForm, vendor: e.target.value })}
                  className="form-input w-full text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Description</label>
              <input
                type="text"
                placeholder="Description"
                value={expForm.description || ''}
                onChange={(e) => setExpForm({ ...expForm, description: e.target.value })}
                className="form-input w-full text-sm"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleLogExpense}
                disabled={saving}
                className="btn btn-primary btn-sm text-xs"
              >
                {saving ? 'Saving...' : 'Log Expense'}
              </button>
              <button
                onClick={() => {
                  setShowLogExpense(false);
                  setExpForm({ date: new Date().toISOString().split('T')[0], category: 'other' });
                }}
                className="btn btn-ghost btn-sm text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {filteredExpenses.length > 0 ? (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">Date</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">Category</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">Description</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.map((exp) => (
                <tr key={exp.id} className="border-b border-slate-200 hover:bg-slate-50">
                  <td className="px-6 py-3 text-sm text-slate-600 font-mono">{exp.date}</td>
                  <td className="px-6 py-3">
                    <span className="text-xs font-medium text-slate-700">
                      {CAT_LABELS[exp.category] || 'Other'}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm text-slate-700">
                    {exp.vendor ? <span className="font-medium">{exp.vendor}</span> : null}
                    {exp.vendor && exp.description ? ' — ' : ''}
                    {exp.description || (!exp.vendor ? 'Expense' : '')}
                  </td>
                  <td className="px-6 py-3 text-right text-sm font-bold text-red-600">
                    −{currency(exp.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-12 text-center text-slate-500 text-sm">
            No expenses logged for this period.
          </div>
        )}
      </div>
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
