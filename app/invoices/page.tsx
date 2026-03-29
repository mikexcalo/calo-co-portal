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
import styles from './page.module.css';

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
    return <div className={styles.loading}>Loading invoices...</div>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>All Invoices</h1>
        <button
          className={styles.newBtn}
          onClick={() => router.push('/clients')}
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
          <div className={styles.statLabel}>Total Billed</div>
          <div className={styles.statValue}>{currency(stats.billed)}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Outstanding</div>
          <div className={styles.statValue}>{currency(stats.outstanding)}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Collected</div>
          <div className={styles.statValue}>{currency(stats.paid)}</div>
        </div>
      </div>

      <div className={styles.card}>
        <InvoiceTable invoices={invoices} onDelete={handleDelete} showDelete isAgencyView />
      </div>
    </div>
  );
}
