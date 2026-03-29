'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DB, loadExpenses, saveAgencySettings } from '@/lib/database';
import { Expense } from '@/lib/types';
import ProfitLoss from '@/components/financials/ProfitLoss';
import ExpensesList from '@/components/financials/ExpensesList';
import RevenueByClient from '@/components/financials/RevenueByClient';
import { currency } from '@/lib/utils';

type Period = 'month' | 'quarter' | 'year' | 'all';

export default function FinancialsPage() {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>('month');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [taxRate, setTaxRate] = useState(DB.agencySettings.taxRate || 28);
  const [fiscalYearStart, setFiscalYearStart] = useState(DB.agencySettings.fiscalYearStart || 1);
  const [taxSettingsOpen, setTaxSettingsOpen] = useState(false);
  const [showLogExpense, setShowLogExpense] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');

  useEffect(() => {
    const init = async () => {
      await loadExpenses().catch((e) => console.warn('[financials] loadExpenses failed:', e));
      setExpenses([...DB.expenses]);
    };
    init();
  }, []);

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

  const filteredExpenses = expenses.filter((e) => e.date >= start && e.date <= end);
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  const periodLabel =
    period === 'month' ? 'This Month' : period === 'quarter' ? 'This Quarter' : period === 'year' ? 'This Fiscal Year' : 'All Time';

  const handleSaveTaxSettings = async () => {
    setLoading(true);
    await saveAgencySettings(taxRate, fiscalYearStart);
    setSaveStatus('Tax settings saved');
    setTaxSettingsOpen(false);
    setTimeout(() => setSaveStatus(''), 3000);
    setLoading(false);
  };

  const handlePrintPL = () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>P&L — ${periodLabel}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', Arial, sans-serif; background: #fff; color: #111; padding: 48px 40px; }
    .hd { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 18px; margin-bottom: 28px; }
    .title { font-size: 22px; font-weight: 700; }
    .sub { font-size: 12px; color: #888; margin-top: 4px; }
    .meta { font-size: 10px; color: #bbb; text-align: right; line-height: 1.7; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th { font-size: 9px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: #bbb; padding: 6px 0; border-bottom: 1px solid #e8e8e8; text-align: left; }
    td { padding: 7px 0; font-size: 13px; color: #475569; border-bottom: 1px solid #f7f7f7; }
    .r { text-align: right; }
    .total td { font-weight: 700; color: #0f172a; font-size: 13.5px; border-top: 1px solid #e2e8f0; border-bottom: none; padding-top: 10px; }
    .net td { font-size: 15px; font-weight: 700; color: #0f172a; border-top: 2px solid #111; border-bottom: none; padding-top: 12px; }
    .tax td { font-size: 12px; color: #64748b; }
    .takehome td { font-size: 14px; font-weight: 700; color: #16a34a; }
    .neg { color: #dc2626 !important; }
    @media print { body { padding: 0; } @page { margin: 0.5in; size: letter; } }
  </style>
</head>
<body>
  <div class="hd">
    <div>
      <div class="title">${DB.agency.name} — Profit & Loss</div>
      <div class="sub">${periodLabel}</div>
    </div>
    <div class="meta">${DB.agency.founder}<br/>${DB.agency.url}<br/>Prepared ${dateStr}</div>
  </div>
  <table>
    <tr><th>Revenue</th><th class="r"></th></tr>
    <tr><td>Total Revenue</td><td class="r">$0.00</td></tr>
  </table>
  <table>
    <tr><th>Expenses</th><th class="r"></th></tr>
    <tr><td>Total Expenses</td><td class="r">−${currency(totalExpenses)}</td></tr>
  </table>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    window.open(URL.createObjectURL(blob), '_blank');
  };

  return (
    <div className="page">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-1">Financials</h1>
            <p className="text-sm text-slate-500">Agency-wide revenue and expense tracking</p>
          </div>
          <button
            onClick={handlePrintPL}
            className="btn btn-ghost text-sm"
          >
            📄 Print P&L
          </button>
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
        <StatCard label="Gross Revenue" value={currency(0)} sub="$0.00 services + $0.00 pass-through" />
        <StatCard label="Total Expenses" value={currency(totalExpenses)} sub={`${filteredExpenses.length} expense${filteredExpenses.length !== 1 ? 's' : ''}`} />
        <StatCard label="Net Income" value={currency(0)} sub="Before tax" />
        <StatCard label={`Tax Estimate (${taxRate}%)`} value={currency(0)} sub={`Take-home: ${currency(0)}`} />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* P&L Section */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-slate-900">Profit & Loss</h2>
            <span className="text-xs text-slate-500">{periodLabel}</span>
          </div>
          <ProfitLoss period={period} />
        </div>

        {/* Expenses Section */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-slate-900">Expenses</h2>
            <button
              onClick={() => setShowLogExpense(true)}
              className="btn btn-ghost btn-sm text-xs"
            >
              + Log Expense
            </button>
          </div>
          <ExpensesList expenses={filteredExpenses} />
        </div>
      </div>

      {/* Revenue by Client Table */}
      <RevenueByClient period={period} />

      {/* Tax Settings Section */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 mt-8">
        <button
          onClick={() => setTaxSettingsOpen(!taxSettingsOpen)}
          className="text-xs text-slate-500 hover:text-slate-700 mb-4"
        >
          ⚙ Tax Settings
        </button>

        {taxSettingsOpen && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 mb-4">Tax Rate Settings</h3>
            <div className="flex gap-4 items-end flex-wrap">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-2">Tax Rate %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={taxRate}
                  onChange={(e) => setTaxRate(parseFloat(e.target.value) || 28)}
                  className="form-input"
                  style={{ width: '90px' }}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-2">Fiscal Year Starts (month #)</label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={fiscalYearStart}
                  onChange={(e) => setFiscalYearStart(parseInt(e.target.value) || 1)}
                  className="form-input"
                  style={{ width: '70px' }}
                />
              </div>
              <button
                onClick={handleSaveTaxSettings}
                disabled={loading}
                className="btn btn-primary btn-sm"
              >
                {loading ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => setTaxSettingsOpen(false)}
                className="btn btn-ghost btn-sm"
              >
                Cancel
              </button>
              {saveStatus && (
                <span className="text-xs text-green-600">{saveStatus}</span>
              )}
            </div>
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
