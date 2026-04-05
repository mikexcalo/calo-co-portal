'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DB, loadInvoices, loadExpenses, saveExpense } from '@/lib/database';
import { Client, Invoice, Expense } from '@/lib/types';
import { currency, invTotal, metricColor } from '@/lib/utils';
import { useTheme } from '@/lib/theme';
import { motion } from 'framer-motion';
import SegmentedControl from '@/components/shared/SegmentedControl';

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const fadeUp = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } } };
const spring = { type: 'spring' as const, stiffness: 400, damping: 25 };

const CAT_LABELS: Record<string, string> = { contractor: 'Contractor', software: 'Software', materials: 'Materials', travel: 'Travel', other: 'Other' };
type Period = 'month' | 'quarter' | 'year' | 'all';

export default function ClientFinancialsPage() {
  const params = useParams();
  const { t } = useTheme();
  const clientId = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [period, setPeriod] = useState<Period>('month');
  const [showLogExpense, setShowLogExpense] = useState(false);
  const [expForm, setExpForm] = useState<Partial<Expense>>({ date: new Date().toISOString().split('T')[0], category: 'other' });
  const [saving, setSaving] = useState(false);

  const taxRate = DB.agencySettings.taxRate || 28;

  const refreshData = useCallback(() => {
    setInvoices(DB.invoices.filter((i) => i.clientId === clientId));
    setExpenses(DB.expenses.filter((e) => e.clientId === clientId));
  }, [clientId]);

  useEffect(() => {
    const init = async () => {
      const found = DB.clients.find((c) => c.id === clientId);
      setClient(found || null);
      if (found) { await loadInvoices(clientId); await loadExpenses().catch(() => {}); refreshData(); }
    };
    init();
  }, [clientId, refreshData]);

  if (!client) return <div style={{ padding: 32, fontSize: 13, color: t.status.danger }}>Client not found</div>;

  const getPeriodDates = () => {
    const now = new Date(); const year = now.getFullYear(); const month = now.getMonth();
    switch (period) {
      case 'month': { const s = new Date(year, month, 1); const e = new Date(year, month + 1, 0); return { start: s.toISOString().split('T')[0], end: e.toISOString().split('T')[0] }; }
      case 'quarter': { const q = Math.floor(month / 3); const s = new Date(year, q * 3, 1); const e = new Date(year, q * 3 + 3, 0); return { start: s.toISOString().split('T')[0], end: e.toISOString().split('T')[0] }; }
      case 'year': return { start: `${now.getFullYear()}-01-01`, end: `${now.getFullYear()}-12-31` };
      default: return { start: '2000-01-01', end: '2099-12-31' };
    }
  };

  const { start, end } = getPeriodDates();
  const filteredInvs = invoices.filter((i) => !i.isReimbursement && i.date >= start && i.date <= end);
  const filteredExps = expenses.filter((e) => e.date >= start && e.date <= end);
  const grossRevenue = filteredInvs.filter((i) => i.status === 'paid').reduce((s, i) => s + invTotal(i), 0);
  const totalExpenses = filteredExps.reduce((s, e) => s + e.amount, 0);
  const netIncome = grossRevenue - totalExpenses;
  const taxEstimate = netIncome > 0 ? netIncome * (taxRate / 100) : 0;
  const periodLabel = period === 'month' ? 'This Month' : period === 'quarter' ? 'This Quarter' : period === 'year' ? 'This Year' : 'All Time';

  const handleLogExpense = async () => {
    if (!expForm.date || !expForm.amount || expForm.amount <= 0) return;
    setSaving(true);
    const newExp: Expense = { date: expForm.date, category: expForm.category || 'other', vendor: expForm.vendor || '', description: expForm.description || '', amount: expForm.amount, clientId, notes: expForm.notes || '' };
    const saved = await saveExpense(newExp);
    if (saved) DB.expenses.unshift({ ...newExp, id: saved.id });
    refreshData(); setShowLogExpense(false); setExpForm({ date: new Date().toISOString().split('T')[0], category: 'other' }); setSaving(false);
  };

  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', fontSize: 13, border: `1px solid ${t.border.default}`, borderRadius: 8, fontFamily: 'inherit', background: t.bg.primary, color: t.text.primary };
  const th: React.CSSProperties = { padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.3px' };
  const td: React.CSSProperties = { padding: '12px 16px', fontSize: 13, color: t.text.secondary, borderBottom: `1px solid ${t.border.default}` };

  return (
    <div style={{ padding: 32, maxWidth: 960 }}>
      <motion.div variants={stagger} initial="hidden" animate="show">
        <motion.div variants={fadeUp} style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 20, fontWeight: 400, margin: '0 0 2px', color: t.text.primary }}>{client.company || client.name} — Financials</h1>
          <p style={{ fontSize: 13, color: t.text.tertiary, margin: 0 }}>Client revenue and expense tracking</p>
        </motion.div>

        <motion.div variants={fadeUp} style={{ marginBottom: 20 }}>
          <SegmentedControl
            tabs={[{ key: 'month', label: 'Month' }, { key: 'quarter', label: 'Quarter' }, { key: 'year', label: 'Year' }, { key: 'all', label: 'All Time' }]}
            activeTab={period} onChange={(k) => setPeriod(k as Period)}
          />
        </motion.div>

        <motion.div variants={fadeUp} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
          {[
            { label: 'Gross Revenue', value: currency(grossRevenue), color: metricColor(grossRevenue, t.status.success, t.text.secondary) },
            { label: 'Total Expenses', value: currency(totalExpenses), color: metricColor(totalExpenses, t.status.danger, t.text.secondary) },
            { label: 'Net Income', value: currency(netIncome), color: t.text.primary },
            { label: `Tax Est. (${taxRate}%)`, value: currency(taxEstimate), color: t.text.secondary },
          ].map((m) => (
            <motion.div key={m.label} whileHover={{ y: -1 }} transition={spring} style={{
              background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: t.radius.lg, padding: 16,
            }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{m.label}</div>
              <div style={{ fontSize: 24, fontWeight: 500, color: m.color }}>{m.value}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Revenue */}
        <motion.div variants={fadeUp} style={{ background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
          <div style={{ padding: '16px 16px', borderBottom: `1px solid ${t.border.default}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: t.text.primary }}>Revenue — {periodLabel}</span>
          </div>
          {filteredInvs.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>Invoice #</th><th style={th}>Date</th><th style={th}>Status</th><th style={{ ...th, textAlign: 'right' }}>Amount</th></tr></thead>
              <tbody>
                {filteredInvs.map((inv) => (
                  <tr key={inv.id} style={{ transition: 'background 150ms' }} onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = t.bg.surfaceHover} onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                    <td style={{ ...td, fontWeight: 500, color: t.text.primary }}>#{inv.id}{inv.project ? ` — ${inv.project}` : ''}</td>
                    <td style={td}>{inv.date}</td>
                    <td style={td}><span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: inv.status === 'paid' ? 'rgba(0,200,83,0.1)' : 'rgba(255,171,0,0.1)', color: inv.status === 'paid' ? t.status.success : t.status.warning }}>{inv.status === 'paid' ? 'Paid' : 'Outstanding'}</span></td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 600, color: t.text.primary }}>{currency(invTotal(inv))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div style={{ padding: 40, textAlign: 'center', fontSize: 13, color: t.text.tertiary }}>No invoices in this period.</div>}
        </motion.div>

        {/* Expenses */}
        <motion.div variants={fadeUp} style={{ background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '16px 16px', borderBottom: `1px solid ${t.border.default}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: t.text.primary }}>Expenses — {periodLabel}</span>
            <button onClick={() => setShowLogExpense(!showLogExpense)} style={{ background: 'none', border: 'none', fontSize: 13, color: t.accent.text, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>+ Log Expense</button>
          </div>
          {showLogExpense && (
            <div style={{ padding: 16, borderBottom: `1px solid ${t.border.default}`, background: t.bg.surfaceHover }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div><label style={{ fontSize: 11, fontWeight: 500, color: t.text.secondary, display: 'block', marginBottom: 4 }}>Date</label><input type="date" value={expForm.date || ''} onChange={(e) => setExpForm({ ...expForm, date: e.target.value })} style={inputStyle} /></div>
                <div><label style={{ fontSize: 11, fontWeight: 500, color: t.text.secondary, display: 'block', marginBottom: 4 }}>Amount</label><input type="number" step="0.01" placeholder="0.00" value={expForm.amount || ''} onChange={(e) => setExpForm({ ...expForm, amount: parseFloat(e.target.value) || 0 })} style={inputStyle} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div><label style={{ fontSize: 11, fontWeight: 500, color: t.text.secondary, display: 'block', marginBottom: 4 }}>Category</label><select value={expForm.category || 'other'} onChange={(e) => setExpForm({ ...expForm, category: e.target.value })} style={inputStyle}>{Object.entries(CAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                <div><label style={{ fontSize: 11, fontWeight: 500, color: t.text.secondary, display: 'block', marginBottom: 4 }}>Description</label><input type="text" placeholder="Description" value={expForm.description || ''} onChange={(e) => setExpForm({ ...expForm, description: e.target.value })} style={inputStyle} /></div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button onClick={handleLogExpense} disabled={saving} style={{ padding: '8px 16px', fontSize: 13, fontWeight: 500, background: t.accent.primary, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>{saving ? 'Saving...' : 'Log Expense'}</button>
                <button onClick={() => setShowLogExpense(false)} style={{ padding: '8px 16px', fontSize: 13, fontWeight: 500, background: t.bg.surface, color: t.text.secondary, border: `1px solid ${t.border.default}`, borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              </div>
            </div>
          )}
          {filteredExps.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>Date</th><th style={th}>Category</th><th style={th}>Description</th><th style={{ ...th, textAlign: 'right' }}>Amount</th></tr></thead>
              <tbody>
                {filteredExps.map((exp) => (
                  <tr key={exp.id} style={{ transition: 'background 150ms' }} onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = t.bg.surfaceHover} onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                    <td style={td}>{exp.date}</td>
                    <td style={td}>{CAT_LABELS[exp.category] || 'Other'}</td>
                    <td style={{ ...td, color: t.text.primary }}>{exp.vendor ? <span style={{ fontWeight: 500 }}>{exp.vendor}</span> : null}{exp.vendor && exp.description ? ' — ' : ''}{exp.description || (!exp.vendor ? 'Expense' : '')}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 600, color: t.status.danger }}>−{currency(exp.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div style={{ padding: 40, textAlign: 'center', fontSize: 13, color: t.text.tertiary }}>No expenses in this period.</div>}
        </motion.div>
      </motion.div>
    </div>
  );
}
