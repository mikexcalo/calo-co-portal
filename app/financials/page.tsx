'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DB, loadExpenses, saveAgencySettings } from '@/lib/database';
import { Expense } from '@/lib/types';
import ProfitLoss from '@/components/financials/ProfitLoss';
import ExpensesList from '@/components/financials/ExpensesList';
import RevenueByClient from '@/components/financials/RevenueByClient';
import { currency } from '@/lib/utils';
import { PageLayout, MetricCard, Section } from '@/components/shared/PageLayout';

type Period = 'month' | 'quarter' | 'year' | 'all';

export default function FinancialsPage() {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>('month');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [taxRate, setTaxRate] = useState(DB.agencySettings.taxRate || 28);
  const [fiscalYearStart, setFiscalYearStart] = useState(DB.agencySettings.fiscalYearStart || 1);
  const [taxSettingsOpen, setTaxSettingsOpen] = useState(false);
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
        const s = new Date(year, month, 1); const e = new Date(year, month + 1, 0);
        return { start: s.toISOString().split('T')[0], end: e.toISOString().split('T')[0] };
      }
      case 'quarter': {
        const q = Math.floor(month / 3);
        const s = new Date(year, q * 3, 1); const e = new Date(year, q * 3 + 3, 0);
        return { start: s.toISOString().split('T')[0], end: e.toISOString().split('T')[0] };
      }
      case 'year': {
        const s = new Date(year, 0, 1); const e = new Date(year, 11, 31);
        return { start: s.toISOString().split('T')[0], end: e.toISOString().split('T')[0] };
      }
      default: return { start: '2000-01-01', end: '2099-12-31' };
    }
  };

  const { start, end } = getPeriodDates();
  const filteredExpenses = expenses.filter((e) => e.date >= start && e.date <= end);
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const periodLabel = period === 'month' ? 'This Month' : period === 'quarter' ? 'This Quarter' : period === 'year' ? 'This Fiscal Year' : 'All Time';

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
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>P&L — ${periodLabel}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Inter',Arial,sans-serif;background:#fff;color:#111;padding:48px 40px}.hd{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:18px;margin-bottom:28px}.title{font-size:22px;font-weight:700}.sub{font-size:12px;color:#888;margin-top:4px}.meta{font-size:10px;color:#bbb;text-align:right;line-height:1.7}table{width:100%;border-collapse:collapse;margin-bottom:20px}th{font-size:9px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#bbb;padding:6px 0;border-bottom:1px solid #e8e8e8;text-align:left}td{padding:7px 0;font-size:13px;color:#475569;border-bottom:1px solid #f7f7f7}.r{text-align:right}@media print{body{padding:0}@page{margin:0.5in;size:letter}}</style></head><body><div class="hd"><div><div class="title">${DB.agency.name} — Profit & Loss</div><div class="sub">${periodLabel}</div></div><div class="meta">${DB.agency.founder}<br/>${DB.agency.url}<br/>Prepared ${dateStr}</div></div><table><tr><th>Revenue</th><th class="r"></th></tr><tr><td>Total Revenue</td><td class="r">$0.00</td></tr></table><table><tr><th>Expenses</th><th class="r"></th></tr><tr><td>Total Expenses</td><td class="r">−${currency(totalExpenses)}</td></tr></table></body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    window.open(URL.createObjectURL(blob), '_blank');
  };

  return (
    <PageLayout
      title="Financials"
      subtitle="Agency-wide revenue and expense tracking"
      action={
        <button onClick={handlePrintPL} style={{
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
          padding: '6px 14px', fontSize: 13, fontWeight: 500, color: '#374151',
          cursor: 'pointer', fontFamily: 'Inter, sans-serif',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="1" width="16" height="22" rx="2"/><line x1="8" y1="7" x2="16" y2="7" strokeLinecap="round"/><line x1="8" y1="11" x2="16" y2="11" strokeLinecap="round"/></svg>
          Print P&L
        </button>
      }
    >
      {/* Period Selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['month', 'quarter', 'year', 'all'] as Period[]).map((p) => (
          <button key={p} onClick={() => setPeriod(p)} style={{
            padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
            border: period === p ? '1.5px solid #2563eb' : '1px solid #e5e7eb',
            background: period === p ? '#eff6ff' : '#fff',
            color: period === p ? '#2563eb' : '#6b7280',
            cursor: 'pointer', fontFamily: 'Inter, sans-serif',
          }}>
            {p === 'month' ? 'Month' : p === 'quarter' ? 'Quarter' : p === 'year' ? 'Year' : 'All Time'}
          </button>
        ))}
      </div>

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 24 }}>
        <MetricCard label="Gross Revenue" value={currency(0)} />
        <MetricCard label="Total Expenses" value={currency(totalExpenses)} color="#D97706" />
        <MetricCard label="Net Income" value={currency(0)} />
        <MetricCard label={`Tax Est. (${taxRate}%)`} value={currency(0)} />
      </div>

      {/* P&L + Expenses — two columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div style={{ background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Profit & Loss</span>
            <span style={{ fontSize: 11, color: '#9ca3af' }}>{periodLabel}</span>
          </div>
          <ProfitLoss period={period} />
        </div>
        <div style={{ background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Expenses</span>
          </div>
          <ExpensesList expenses={filteredExpenses} />
        </div>
      </div>

      {/* Revenue by Client */}
      <Section label="Revenue by Client">
        <RevenueByClient period={period} />
      </Section>

      {/* Tax Settings */}
      <div style={{ background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
        <button onClick={() => setTaxSettingsOpen(!taxSettingsOpen)} style={{
          background: 'none', border: 'none', fontSize: 12, color: '#9ca3af',
          cursor: 'pointer', fontFamily: 'Inter, sans-serif', padding: 0,
        }}>
          {taxSettingsOpen ? '− Tax Settings' : '+ Tax Settings'}
        </button>
        {taxSettingsOpen && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '0.5px solid #e5e7eb' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Tax Rate %</label>
                <input type="number" min="0" max="100" step="0.1" value={taxRate}
                  onChange={(e) => setTaxRate(parseFloat(e.target.value) || 28)}
                  style={{ width: 90, padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, fontFamily: 'Inter, sans-serif' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Fiscal Year Start</label>
                <input type="number" min="1" max="12" value={fiscalYearStart}
                  onChange={(e) => setFiscalYearStart(parseInt(e.target.value) || 1)}
                  style={{ width: 70, padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, fontFamily: 'Inter, sans-serif' }} />
              </div>
              <button onClick={handleSaveTaxSettings} disabled={loading} style={{
                padding: '8px 16px', fontSize: 13, fontWeight: 500, background: '#2563eb', color: '#fff',
                border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}>{loading ? 'Saving...' : 'Save'}</button>
              <button onClick={() => setTaxSettingsOpen(false)} style={{
                padding: '8px 16px', fontSize: 13, fontWeight: 500, background: '#fff', color: '#6b7280',
                border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}>Cancel</button>
              {saveStatus && <span style={{ fontSize: 12, color: '#16a34a' }}>{saveStatus}</span>}
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
