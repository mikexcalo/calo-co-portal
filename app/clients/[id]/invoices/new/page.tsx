'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  loadClients,
  saveInvoice,
  uploadInvoiceAttachment,
  logActivity,
  DB,
} from '@/lib/database';
import { invTotal, isoToDisplay } from '@/lib/utils';
import InvoiceForm from '@/components/invoices/InvoiceForm';
import ReceiptDrop from '@/components/invoices/ReceiptDrop';
import { Invoice, InvoiceItem } from '@/lib/types';
import styles from './page.module.css';

export default function NewInvoicePage() {
  const router = useRouter();
  const params = useParams();
  const clientId = params.id as string;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  useEffect(() => {
    const init = async () => {
      if (DB.clients.length === 0) {
        await loadClients();
      }
    };
    init();
  }, []);

  const handleSaveInvoice = async (
    formData: Omit<Invoice, '_uuid' | 'id'> & { items: InvoiceItem[] }
  ) => {
    try {
      setIsLoading(true);
      setError(null);

      const client = DB.clients.find((c) => c.id === formData.clientId);
      if (!client) {
        setError('Client not found');
        return;
      }

      // Generate invoice ID based on client initials
      const existingCount = DB.invoices.filter((i) => i.clientId === formData.clientId).length;
      const num = existingCount + 1;
      const coInitials = (client.company || client.name)
        .split(/\s+/)
        .map((w) => w[0])
        .slice(0, 3)
        .join('')
        .toUpperCase()
        .replace(/[^A-Z]/g, '')
        .slice(0, 3);
      const invoiceId = `CC-${coInitials}-${String(num).padStart(2, '0')}`;

      // Upload attachment if present
      let attachmentUrl: string | null = null;
      if (selectedFiles.length > 0) {
        try {
          attachmentUrl = await uploadInvoiceAttachment(selectedFiles[0]);
        } catch (e) {
          console.warn('Attachment upload failed:', e);
        }
      }

      // Create invoice object
      const invoice: Invoice = {
        id: invoiceId,
        clientId: formData.clientId,
        project: formData.project,
        date: formData.date,
        due: formData.due,
        items: formData.items,
        tax: formData.tax,
        shipping: formData.shipping,
        status: 'unpaid',
        notes: formData.notes,
        type: formData.type,
        isReimbursement: formData.isReimbursement,
        netCost: formData.netCost,
        paidDate: null,
        internalNotes: '',
        projectDesc: '',
        vendorOrder: '—',
        vendorDate: '—',
        attachmentUrl,
      };

      // Save to database
      await saveInvoice(invoice);

      // Log activity
      const total = invTotal(invoice);
      await logActivity(formData.clientId, 'invoice_sent', {
        invoiceId: invoice.id,
        amount: total,
      });

      // Add to local cache
      DB.invoices.push(invoice);

      // Navigate to invoices list
      router.push(`/clients/${formData.clientId}/invoices`);
    } catch (e) {
      console.error('Error saving invoice:', e);
      setError('Failed to save invoice. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <button
        onClick={() => router.push(`/clients/${params.id}/invoices`)}
        style={{
          background: 'none', border: 'none', color: '#6366f1', fontSize: '13px',
          fontWeight: 500, cursor: 'pointer', padding: 0, marginBottom: '16px',
          display: 'inline-flex', alignItems: 'center', gap: '4px', fontFamily: 'Inter, sans-serif',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5" /><polyline points="12 19 5 12 12 5" />
        </svg>
        Back to Invoices
      </button>
      <div className={styles.layout}>
        <div className={styles.leftPanel}>
          <h2 className={styles.leftTitle}>Receipt / Screenshot</h2>
          <ReceiptDrop onFilesSelected={setSelectedFiles} isLoading={isLoading} />
          <p className={styles.hint}>
            Optional: Upload a receipt or screenshot to auto-extract invoice details. Supports PNG, JPG, and PDF files.
          </p>
        </div>

        <div className={styles.rightPanel}>
          {error && <div className={styles.errorBanner}>{error}</div>}
          <InvoiceForm
            clients={DB.clients}
            selectedClientId={clientId}
            isAgencyView={false}
            onSave={handleSaveInvoice}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}
