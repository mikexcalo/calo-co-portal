'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  loadInvoices,
  saveInvoice,
  deleteInvoice,
  DB,
} from '@/lib/database';
import { clientStats, invTotal, currency } from '@/lib/utils';
import InvoiceTable from '@/components/invoices/InvoiceTable';
import { Invoice } from '@/lib/types';
import styles from './page.module.css';

export default function ClientInvoicesPage() {
  const router = useRouter();
  const params = useParams();
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
        const clientInvoices = DB.invoices.filter((i) => i.clientId === clientId);
        setInvoices(clientInvoices);
        setStats(clientStats(DB.invoices, clientId));
      } catch (e) {
        console.error('Failed to load invoices:', e);
        setError('Failed to load invoices');
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [clientId]);

  const handleMarkPaid = async (invoiceId: string) => {
    const inv = DB.invoices.find((i) => i.id === invoiceId);
    if (!inv) return;

    try {
      inv.status = 'paid';
      inv.paidDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      await saveInvoice(inv);

      const clientInvoices = DB.invoices.filter((i) => i.clientId === clientId);
      setInvoices([...clientInvoices]);
      setStats(clientStats(DB.invoices, clientId));
    } catch (e) {
      console.error('Failed to mark invoice as paid:', e);
      setError('Failed to update invoice');
    }
  };

  const handleDelete = async (invoiceId: string) => {
    try {
      await deleteInvoice(invoiceId);
      const clientInvoices = DB.invoices.filter((i) => i.clientId === clientId);
      setInvoices([...clientInvoices]);
      setStats(clientStats(DB.invoices, clientId));
    } catch (e) {
      console.error('Failed to delete invoice:', e);
      setError('Failed to delete invoice');
    }
  };

  if (isLoading) {
    return <div className={styles.loading}>Loading invoices...</div>;
  }

  if (!client) {
    return <div className={styles.error}>Client not found</div>;
  }

  return (
    <div className={styles.page}>
      <button
        onClick={() => router.push(`/clients/${clientId}`)}
        style={{
          background: 'none', border: 'none', color: '#6366f1', fontSize: '13px',
          fontWeight: 500, cursor: 'pointer', padding: 0, marginBottom: '16px',
          display: 'inline-flex', alignItems: 'center', gap: '4px', fontFamily: 'Inter, sans-serif',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5" /><polyline points="12 19 5 12 12 5" />
        </svg>
        Back to {client?.company || client?.name || 'Client'}
      </button>
      <div className={styles.header}>
        <h1 className={styles.title}>Invoices</h1>
        <button
          className={styles.newBtn}
          onClick={() => router.push(`/clients/${clientId}/invoices/new`)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Invoice
        </button>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Outstanding</div>
          <div className={styles.statValue}>{currency(stats.outstanding)}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Paid</div>
          <div className={styles.statValue}>{currency(stats.paid)}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Billed</div>
          <div className={styles.statValue}>{currency(stats.billed)}</div>
        </div>
      </div>

      <div className={styles.card}>
        <InvoiceTable invoices={invoices} onMarkPaid={handleMarkPaid} onDelete={handleDelete} />
      </div>
    </div>
  );
}
