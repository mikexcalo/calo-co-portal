'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  loadClients,
  loadInvoices,
  deleteInvoice,
  DB,
} from '@/lib/database';
import { agencyStats, currency } from '@/lib/utils';
import InvoiceTable from '@/components/invoices/InvoiceTable';
import { Invoice } from '@/lib/types';
import { colors } from '@/lib/design-tokens';
import { PageLayout, MetricCard } from '@/components/shared/PageLayout';

export default function AllInvoicesPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({ billed: 0, paid: 0, outstanding: 0, reimbursed: 0, clients: 0, invoices: 0 });
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        if (DB.clients.length === 0) {
          await loadClients();
        }

        // Load invoices for all clients
        for (const client of DB.clients) {
          const existing = DB.invoices.filter((i) => i.clientId === client.id).length;
          if (existing === 0) {
            await loadInvoices(client.id);
          }
        }

        setInvoices(DB.invoices);
        setStats(agencyStats(DB.invoices, DB.clients));
      } catch (e) {
        console.error('Failed to load invoices:', e);
        setError('Failed to load invoices');
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  const handleDelete = async (invoiceId: string) => {
    try {
      await deleteInvoice(invoiceId);
      setInvoices(DB.invoices);
      setStats(agencyStats(DB.invoices, DB.clients));
    } catch (e) {
      console.error('Failed to delete invoice:', e);
      setError('Failed to delete invoice');
    }
  };

  if (isLoading) {
    return <div style={{ padding: '32px 40px', color: '#6b7280', fontSize: 13 }}>Loading invoices...</div>;
  }

  return (
    <PageLayout
      title="All Invoices"
      subtitle="Track and manage client invoices"
      action={
        <button
          onClick={() => router.push('/clients')}
          style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Inter, sans-serif' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Invoice
        </button>
      }
    >
      {error && (
        <div style={{ padding: '12px 16px', background: colors.red.bg, border: `1px solid ${colors.red.border}`, borderRadius: 6, color: colors.red.accent, fontSize: 13, marginBottom: 24 }}>
          {error}
        </div>
      )}

      {/* Metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 24 }}>
        <MetricCard label="Total billed" value={currency(stats.billed)} />
        <MetricCard label="Outstanding" value={currency(stats.outstanding)} color="#D97706" />
        <MetricCard label="Collected" value={currency(stats.paid)} color="#16a34a" />
      </div>

      {/* Invoice table */}
      <div style={{ background: '#ffffff', border: '0.5px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
        <InvoiceTable invoices={invoices} onDelete={handleDelete} showDelete isAgencyView />
      </div>
    </PageLayout>
  );
}
