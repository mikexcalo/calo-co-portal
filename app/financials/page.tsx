'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DB, loadExpenses, saveAgencySettings } from '@/lib/database';
import { Expense } from '@/lib/types';
import ProfitLoss from '@/components/financials/ProfitLoss';
import ExpensesList from '@/components/financials/ExpensesList';
import RevenueByClient from '@/components/financials/RevenueByClient';
import { currency, metricColor } from '@/lib/utils';
import { useTheme } from '@/lib/theme';
import useCountUp from '@/lib/useCountUp';
import { motion } from 'framer-motion';

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const fadeUp = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } } };
const spring = { type: 'spring' as const, stiffness: 400, damping: 25 };

type Period = 'month' | 'quarter' | 'year' | 'all';

export default function FinancialsPage() {
  const router = useRouter();
  const { t } = useTheme();
  const [period, setPeriod] = useState<Period>('month');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [taxRate, setTaxRate] = useState(DB.agencySettings.taxRate || 28);
  const [fiscalYearStart, setFiscalYearStart] = useState(DB.agencySettings.fiscalYearStart || 1);
  const [taxSettingsOpen, setTaxSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');

  useEffect(() => {
    const init = async () => {
      await loadExpenses().catch(() => {});
      setExpenses([...DB.expenses]);
    };
    init();
  }, []);

  const getPeriodDates = () => {
    const now = new Date(); const year = now.getFullYear(); const month = now.getMonth();
    switch (period) {
      case 'month': { const s = new Date(year, month, 1); const e = new Date(year, month + 1, 0); return { start: s.toISOString().split('T')[0], end: e.toISOString().split('T')[0] }; }
      case 'quarter': { const q = Math.floor(month / 3); const s = new Date(year, q * 3, 1); const e = new Date(year, q * 3 + 3, 0); return { start: s.toISOString().split('T')[0], end: e.toISOString().split('T')[0] }; }
      case 'year': { return { start: `${year}-01-01`, end: `${year}-12-31` }; }
      default: return { start: '2000-01-01', end: '2099-12-31' };
    }
  };

  const { start, end } = getPeriodDates();
  const filteredExpenses = expenses.filter((e) => e.date >= start && e.date <= end);
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const animExpenses = useCountUp(totalExpenses);
  const periodLabel = period === 'month' ? 'This Month' : period === 'quarter' ? 'This Quarter' : period === 'year' ? 'This Year' : 'All Time';

  const handleSaveTaxSettings = async () => {
    setLoading(true);
    await saveAgencySettings(taxRate, fiscalYearStart);
    setSaveStatus('Saved'); setTaxSettingsOpen(false);
    setTimeout(() => setSaveStatus(''), 3000); setLoading(false);
  };

  const handlePrintPL = () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>P&L</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui;padding:48px 40px;color:#111}table{width:100%;border-collapse:collapse;margin-bottom:20px}th{font-size:9px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#bbb;padding:6px 0;border-bottom:1px solid #e8e8e8;text-align:left}td{padding:7px 0;font-size:13px;border-bottom:1px solid #f7f7f7}.r{text-align:right}@media print{body{padding:0}@page{margin:0.5in}}</style></head><body><h1 style="font-size:22px;border-bottom:2px solid #111;padding-bottom:18px;margin-bottom:28px">${DB.agency.name} — P&L · ${periodLabel}</h1><p style="font-size:10px;color:#bbb;margin-bottom:24px">Prepared ${dateStr}</p><table><tr><th>Revenue</th><th class="r"></th></tr><tr><td>Total Revenue</td><td class="r">$0.00</td></tr></table><table><tr><th>Expenses</th><th class="r"></th></tr><tr><td>Total Expenses</td><td class="r">−${currency(totalExpenses)}</td></tr></table></body></html>`;
    window.open(URL.createObjectURL(new Blob([html], { type: 'text/html' })), '_blank');
  };

  return (
    <div style={{ padding: 32, maxWidth: 960 }}>
      <motion.div variants={stagger} initial="hidden" animate="show">

        {/* Header */}
        <motion.div variants={fadeUp} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 400, margin: '0 0 2px', color: t.text.primary }}>Financials</h1>
            <p style={{ fontSize: 13, color: t.text.tertiary, margin: 0 }}>Agency-wide revenue and expense tracking</p>
          </div>
          <button onClick={handlePrintPL} style={{
            background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 8,
            padding: '6px 14px', fontSize: 13, fontWeight: 500, color: t.text.primary,
            cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
            transition: 'background 150ms',
          }}
          onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = t.bg.surfaceHover}
          onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = t.bg.surface}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="1" width="16" height="22" rx="2"/><line x1="8" y1="7" x2="16" y2="7" strokeLinecap="round"/><line x1="8" y1="11" x2="16" y2="11" strokeLinecap="round"/></svg>
            Print P&L
          </button>
        </motion.div>

        {/* Period toggle */}
        <motion.div variants={fadeUp} style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          {(['month', 'quarter', 'year', 'all'] as Period[]).map((p) => (
            <button key={p} onClick={() => setPeriod(p)} style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: period === p ? 500 : 400,
              border: `1px solid ${period === p ? t.border.active : t.border.default}`,
              background: period === p ? t.bg.surfaceHover : t.bg.surface,
              color: period === p ? t.text.primary : t.text.secondary,
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 150ms',
            }}>
              {p === 'month' ? 'Month' : p === 'quarter' ? 'Quarter' : p === 'year' ? 'Year' : 'All Time'}
            </button>
          ))}
        </motion.div>

        {/* Metric tiles */}
        <motion.div variants={fadeUp} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
          {[
            { label: 'Gross Revenue', value: currency(0), color: metricColor(0, t.status.success, t.text.secondary) },
            { label: 'Total Expenses', value: currency(Math.round(animExpenses * 100) / 100), color: metricColor(totalExpenses, t.status.danger, t.text.secondary) },
            { label: 'Net Income', value: currency(0), color: t.text.primary },
            { label: `Tax Est. (${taxRate}%)`, value: currency(0), color: t.text.secondary },
          ].map((m) => (
            <motion.div key={m.label} whileHover={{ y: -1 }} transition={spring} style={{
              background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: t.radius.lg,
              padding: 16, transition: 'border-color 150ms',
            }}
            onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.borderColor = t.border.hover}
            onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.borderColor = t.border.default}
            >
              <div style={{ fontSize: 11, fontWeight: 500, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{m.label}</div>
              <div style={{ fontSize: 28, fontWeight: 500, color: m.color }}>{m.value}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* P&L + Expenses */}
        <motion.div variants={fadeUp} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <div style={{ background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: t.text.primary }}>Profit & Loss</span>
              <span style={{ fontSize: 11, color: t.text.tertiary }}>{periodLabel}</span>
            </div>
            <ProfitLoss period={period} />
          </div>
          <div style={{ background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: t.text.primary }}>Expenses</span>
            </div>
            <ExpensesList expenses={filteredExpenses} />
          </div>
        </motion.div>

        {/* Revenue by Client */}
        <motion.div variants={fadeUp} style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Revenue by Client</div>
          <RevenueByClient period={period} />
        </motion.div>

        {/* Tax Settings */}
        <motion.div variants={fadeUp}>
          <div style={{ background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 12, padding: 20 }}>
            <button onClick={() => setTaxSettingsOpen(!taxSettingsOpen)} style={{
              background: 'none', border: 'none', fontSize: 12, color: t.text.tertiary,
              cursor: 'pointer', fontFamily: 'inherit', padding: 0,
            }}>{taxSettingsOpen ? '− Tax Settings' : '+ Tax Settings'}</button>
            {taxSettingsOpen && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${t.border.default}` }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: t.text.secondary, display: 'block', marginBottom: 4 }}>Tax Rate %</label>
                    <input type="number" min="0" max="100" step="0.1" value={taxRate} onChange={(e) => setTaxRate(parseFloat(e.target.value) || 28)}
                      style={{ width: 90, padding: '8px 10px', border: `1px solid ${t.border.default}`, borderRadius: 8, fontSize: 14, fontFamily: 'inherit', background: t.bg.primary, color: t.text.primary }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: t.text.secondary, display: 'block', marginBottom: 4 }}>Fiscal Year Start</label>
                    <input type="number" min="1" max="12" value={fiscalYearStart} onChange={(e) => setFiscalYearStart(parseInt(e.target.value) || 1)}
                      style={{ width: 70, padding: '8px 10px', border: `1px solid ${t.border.default}`, borderRadius: 8, fontSize: 14, fontFamily: 'inherit', background: t.bg.primary, color: t.text.primary }} />
                  </div>
                  <button onClick={handleSaveTaxSettings} disabled={loading} style={{
                    padding: '8px 16px', fontSize: 13, fontWeight: 500, background: t.accent.primary, color: '#fff',
                    border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                  }}>{loading ? 'Saving...' : 'Save'}</button>
                  <button onClick={() => setTaxSettingsOpen(false)} style={{
                    padding: '8px 16px', fontSize: 13, fontWeight: 500, background: t.bg.surface, color: t.text.secondary,
                    border: `1px solid ${t.border.default}`, borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                  }}>Cancel</button>
                  {saveStatus && <span style={{ fontSize: 12, color: t.status.success }}>{saveStatus}</span>}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
