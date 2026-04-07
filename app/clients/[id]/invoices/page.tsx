'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { loadInvoices, saveInvoice, deleteInvoice, logActivity, DB } from '@/lib/database';
import { clientStats, invTotal, currency, metricColor } from '@/lib/utils';
import InvoiceTable from '@/components/invoices/InvoiceTable';
import { Invoice } from '@/lib/types';
import { useTheme } from '@/lib/theme';
import HelmSpinner from '@/components/shared/HelmSpinner';
import { motion } from 'framer-motion';

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const fadeUp = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } } };
const spring = { type: 'spring' as const, stiffness: 400, damping: 25 };

export default function ClientInvoicesPage() {
  const router = useRouter();
  const params = useParams();
  const { t } = useTheme();
  const clientId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({ billed: 0, paid: 0, outstanding: 0, reimbursed: 0, count: 0 });
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState<string | null>(null);

  const client = DB.clients.find((c) => c.id === clientId);

  useEffect(() => {
    const init = async () => {
      try {
        await loadInvoices(clientId);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        for (const inv of DB.invoices.filter((i) => i.clientId === clientId && i.status === 'unpaid')) {
          try { const d = new Date(inv.due); if (!isNaN(d.getTime()) && d < today) { inv.status = 'overdue'; await saveInvoice(inv); } } catch {}
        }
        setInvoices(DB.invoices.filter((i) => i.clientId === clientId));
        setStats(clientStats(DB.invoices, clientId));
      } catch (e) { setError('Failed to load invoices'); }
      finally { setIsLoading(false); }
    };
    init();
  }, [clientId]);

  const handleMarkPaid = async (invoiceId: string) => {
    const inv = DB.invoices.find((i) => i.id === invoiceId);
    if (!inv) return;
    inv.status = 'paid'; inv.paidDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    await saveInvoice(inv); await logActivity(clientId, 'invoice_paid', { invoiceId: inv.id }).catch(() => {});
    setInvoices([...DB.invoices.filter((i) => i.clientId === clientId)]); setStats(clientStats(DB.invoices, clientId));
  };

  const handleDelete = async (invoiceId: string) => {
    await deleteInvoice(invoiceId);
    setInvoices([...DB.invoices.filter((i) => i.clientId === clientId)]); setStats(clientStats(DB.invoices, clientId));
  };

  if (isLoading) return null;
  if (!client) return <div style={{ padding: 32, fontSize: 13, color: t.status.danger }}>Client not found</div>;

  return (
    <div style={{ padding: 32, maxWidth: 960 }}>
      <motion.div variants={stagger} initial="hidden" animate="show">
        <motion.div variants={fadeUp} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 400, margin: '0 0 2px', color: t.text.primary }}>Invoices</h1>
            <p style={{ fontSize: 13, color: t.text.tertiary, margin: 0 }}>{client.company || client.name}</p>
          </div>
          <button onClick={() => router.push(`/clients/${clientId}/invoices/new`)} style={{
            background: t.accent.primary, color: '#fff', border: 'none', borderRadius: 8,
            padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
          }}>+ New Invoice</button>
        </motion.div>

        {error && <div style={{ padding: '12px 16px', background: `rgba(255,61,61,0.08)`, borderRadius: 8, color: t.status.danger, fontSize: 13, marginBottom: 20 }}>{error}</div>}

        <motion.div variants={fadeUp} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
          {[
            { label: 'Outstanding', value: currency(stats.outstanding), color: metricColor(stats.outstanding, t.status.warning, t.text.secondary) },
            { label: 'Paid', value: currency(stats.paid), color: metricColor(stats.paid, t.status.success, t.text.secondary) },
            { label: 'Total Billed', value: currency(stats.billed), color: t.text.primary },
          ].map((m) => (
            <motion.div key={m.label} whileHover={{ y: -1 }} transition={spring} style={{
              background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: t.radius.lg, padding: 16,
            }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: t.text.secondary, marginBottom: 4 }}>{m.label}</div>
              <div style={{ fontSize: 24, fontWeight: 600, color: m.color }}>{m.value}</div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div variants={fadeUp} style={{ background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 12, overflow: 'hidden' }}>
          <InvoiceTable invoices={invoices} onMarkPaid={handleMarkPaid} onDelete={handleDelete} />
        </motion.div>
      </motion.div>
    </div>
  );
}
