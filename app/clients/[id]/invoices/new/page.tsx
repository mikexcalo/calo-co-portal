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
  const [extracting, setExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);

  useEffect(() => {
    const init = async () => {
      if (DB.clients.length === 0) {
        await loadClients();
      }
    };
    init();
  }, []);

  const handleFilesSelected = async (files: File[]) => {
    setSelectedFiles(files);
    if (files.length === 0) return;

    const apiKey = typeof window !== 'undefined' ? localStorage.getItem('CLAUDE_API_KEY') : null;
    if (!apiKey) {
      setError('Configure Claude API key in Settings to enable auto-extraction.');
      return;
    }

    const imageFile = files.find((f) => f.type.startsWith('image/'));
    if (!imageFile) return;

    setExtracting(true);
    setError(null);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = (e) => {
          const result = e.target?.result as string;
          resolve(result.split(',')[1]);
        };
        reader.readAsDataURL(imageFile);
      });

      const mediaType = imageFile.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
              { type: 'text', text: 'Extract invoice details from this receipt image. Return JSON with: { "vendor": "", "items": [{"description": "", "qty": 1, "price": 0}], "tax": 0, "shipping": 0, "total": 0, "notes": "" }. Only return the JSON, no other text.' },
            ],
          }],
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        const text = data.content?.[0]?.text || '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          setExtractedData(parsed);
        }
      } else {
        setError('Failed to extract receipt data. Check your API key.');
      }
    } catch (e) {
      console.error('OCR extraction error:', e);
      setError('Failed to process receipt image.');
    } finally {
      setExtracting(false);
    }
  };

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
    <div className={`page ${styles.page}`}>
      <div className={styles.layout}>
        <div className={styles.leftPanel}>
          <h2 className={styles.leftTitle}>Receipt / Screenshot</h2>
          <ReceiptDrop onFilesSelected={handleFilesSelected} isLoading={isLoading || extracting} />
          {extracting && (
            <p style={{ fontSize: 12, color: '#2563eb', fontWeight: 500 }}>
              Extracting receipt data...
            </p>
          )}
          {extractedData && (
            <div style={{ fontSize: 11, color: '#22c55e', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '6px 10px' }}>
              Extracted: {extractedData.items?.length || 0} line items from {extractedData.vendor || 'receipt'}
            </div>
          )}
          <p className={styles.hint}>
            Upload a receipt to auto-extract invoice details via Claude AI. Supports PNG, JPG, and PDF files.
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
            extractedData={extractedData}
          />
        </div>
      </div>
    </div>
  );
}
