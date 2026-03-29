'use client';

import { useState, useCallback, useEffect } from 'react';
import { Invoice, InvoiceItem, Client } from '@/lib/types';
import { currency, invSubtotal, invTotal } from '@/lib/utils';
import styles from './InvoiceForm.module.css';

interface InvoiceFormProps {
  clients: Client[];
  selectedClientId?: string;
  isAgencyView?: boolean;
  onSave: (invoice: Omit<Invoice, '_uuid' | 'id'> & { items: InvoiceItem[] }) => Promise<void>;
  isLoading?: boolean;
  extractedData?: any;
}

export default function InvoiceForm({
  clients,
  selectedClientId = '',
  isAgencyView = false,
  onSave,
  isLoading = false,
  extractedData,
}: InvoiceFormProps) {
  const [items, setItems] = useState<Array<InvoiceItem & { _tempId: string }>>([
    { description: '', qty: 1, price: 0, _tempId: '1' },
  ]);
  const [nextTempId, setNextTempId] = useState(2);
  const [formData, setFormData] = useState({
    clientId: selectedClientId,
    project: '',
    date: new Date().toISOString().split('T')[0],
    due: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    type: 'service',
    tax: 0,
    shipping: 0,
    margin: 0,
    notes: '',
  });

  const [validation, setValidation] = useState({
    clientError: false,
    itemsError: false,
    dateError: false,
  });

  // Populate from OCR-extracted data
  useEffect(() => {
    if (!extractedData) return;
    if (extractedData.items?.length > 0) {
      let tid = nextTempId;
      const newItems = extractedData.items.map((item: any) => ({
        description: item.description || '', qty: item.qty || 1,
        price: parseFloat(item.price) || 0, _tempId: String(tid++),
      }));
      setItems(newItems);
      setNextTempId(tid);
    }
    setFormData((prev) => ({
      ...prev,
      project: extractedData.vendor || prev.project,
      tax: parseFloat(extractedData.tax) || prev.tax,
      shipping: parseFloat(extractedData.shipping) || prev.shipping,
      notes: extractedData.notes || prev.notes,
    }));
  }, [extractedData]);

  const subtotal = invSubtotal({ ...formData, items: items.map(({ _tempId, ...i }) => i), clientId: '', id: '', status: 'draft' } as any);
  const total = subtotal + formData.tax + formData.shipping;

  const handleAddItem = useCallback(() => {
    const newId = nextTempId.toString();
    setNextTempId(nextTempId + 1);
    setItems([...items, { description: '', qty: 1, price: 0, _tempId: newId }]);
  }, [items, nextTempId]);

  const handleRemoveItem = (tempId: string) => {
    setItems(items.filter((i) => i._tempId !== tempId));
  };

  const handleItemChange = (tempId: string, field: 'description' | 'qty' | 'price', value: any) => {
    setItems(
      items.map((item) => {
        if (item._tempId !== tempId) return item;
        if (field === 'qty' || field === 'price') {
          return { ...item, [field]: parseFloat(value) || 0 };
        }
        return { ...item, [field]: value };
      })
    );
  };

  const handleFormChange = (field: string, value: any) => {
    if (field === 'tax' || field === 'shipping' || field === 'margin') {
      setFormData({ ...formData, [field]: parseFloat(value) || 0 });
    } else {
      setFormData({ ...formData, [field]: value });
    }
  };

  const validateForm = (): boolean => {
    const newValidation = {
      clientError: !formData.clientId,
      itemsError: !items.some((i) => i.description.trim() && i.price > 0),
      dateError: !formData.date,
    };
    setValidation(newValidation);
    return !newValidation.clientError && !newValidation.itemsError && !newValidation.dateError;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const cleanItems = items.map(({ _tempId, ...item }) => item);
    const invoice = {
      clientId: formData.clientId,
      project: formData.project || 'Untitled Project',
      date: formData.date,
      due: formData.due || formData.date,
      items: cleanItems,
      tax: formData.tax,
      shipping: formData.shipping,
      status: 'unpaid' as const,
      notes: formData.notes,
      type: formData.type,
      isReimbursement: formData.type === 'reimbursement',
      netCost: formData.margin,
      paidDate: null,
      internalNotes: '',
      projectDesc: '',
      vendorOrder: '—',
      vendorDate: '—',
      attachmentUrl: null,
    };

    await onSave(invoice);
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.title}>New Invoice</div>

      {/* Client selector */}
      <div className={styles.group}>
        <label className={styles.label}>
          Client <span className={styles.required}>*</span>
        </label>
        <select
          className={`${styles.input} ${styles.select} ${validation.clientError ? styles.error : ''}`}
          value={formData.clientId}
          onChange={(e) => handleFormChange('clientId', e.target.value)}
          disabled={isLoading}
        >
          <option value="">— Select client —</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.company || c.name}
            </option>
          ))}
        </select>
        {validation.clientError && <div className={styles.errorMsg}>Please select a client</div>}
      </div>

      {/* Project name */}
      <div className={styles.group}>
        <label className={styles.label}>Project Name</label>
        <input
          type="text"
          className={styles.input}
          placeholder="e.g. Brand Merchandise — Summer 2026"
          value={formData.project}
          onChange={(e) => handleFormChange('project', e.target.value)}
          disabled={isLoading}
        />
      </div>

      {/* Dates */}
      <div className={styles.row}>
        <div className={styles.group}>
          <label className={styles.label}>
            Invoice Date <span className={styles.required}>*</span>
          </label>
          <input
            type="date"
            className={`${styles.input} ${validation.dateError ? styles.error : ''}`}
            value={formData.date}
            onChange={(e) => handleFormChange('date', e.target.value)}
            disabled={isLoading}
          />
        </div>
        <div className={styles.group}>
          <label className={styles.label}>Due Date</label>
          <input
            type="date"
            className={styles.input}
            value={formData.due}
            onChange={(e) => handleFormChange('due', e.target.value)}
            disabled={isLoading}
          />
        </div>
      </div>

      {/* Type */}
      <div className={styles.group}>
        <label className={styles.label}>Type</label>
        <select
          className={`${styles.input} ${styles.select}`}
          value={formData.type}
          onChange={(e) => handleFormChange('type', e.target.value)}
          disabled={isLoading}
        >
          <option value="service">Service Invoice (counts as revenue)</option>
          <option value="reimbursement">Pass-Through / Reimbursement</option>
        </select>
      </div>

      {/* Line items */}
      <div className={styles.group}>
        <label className={styles.label}>Line Items</label>
        <table className={styles.itemsTable}>
          <thead>
            <tr>
              <th>Item</th>
              <th className={styles.narrow}>Qty</th>
              <th className={`${styles.narrow} ${styles.right}`}>Price</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item._tempId}>
                <td>
                  <input
                    type="text"
                    className={styles.itemInput}
                    placeholder="Item name"
                    value={item.description}
                    onChange={(e) => handleItemChange(item._tempId, 'description', e.target.value)}
                    disabled={isLoading}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    className={`${styles.itemInput} ${styles.narrow}`}
                    min="1"
                    value={item.qty}
                    onChange={(e) => handleItemChange(item._tempId, 'qty', e.target.value)}
                    disabled={isLoading}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    className={`${styles.itemInput} ${styles.narrow} ${styles.right}`}
                    step="0.01"
                    value={item.price.toFixed(2)}
                    onChange={(e) => handleItemChange(item._tempId, 'price', e.target.value)}
                    disabled={isLoading}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className={styles.deleteBtn}
                    onClick={() => handleRemoveItem(item._tempId)}
                    disabled={isLoading}
                    title="Delete item"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {validation.itemsError && <div className={styles.errorMsg}>Add at least one item with a price</div>}
        <button
          type="button"
          className={styles.addItemBtn}
          onClick={handleAddItem}
          disabled={isLoading}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add item
        </button>

        {/* Totals */}
        <div className={styles.totals}>
          <div className={styles.totalRow}>
            <span>Subtotal</span>
            <span>{currency(subtotal)}</span>
          </div>
          <div className={styles.totalRow}>
            <span>Tax</span>
            <input
              type="number"
              className={styles.totalInput}
              step="0.01"
              value={formData.tax.toFixed(2)}
              onChange={(e) => handleFormChange('tax', e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className={styles.totalRow}>
            <span>Shipping</span>
            <input
              type="number"
              className={styles.totalInput}
              step="0.01"
              value={formData.shipping.toFixed(2)}
              onChange={(e) => handleFormChange('shipping', e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className={`${styles.totalRow} ${styles.final}`}>
            <span>Total</span>
            <span>{currency(total)}</span>
          </div>
          {isAgencyView && (
            <div className={`${styles.totalRow} ${styles.margin}`}>
              <span>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Internal Margin
              </span>
              <input
                type="number"
                className={styles.totalInput}
                step="0.01"
                placeholder="0.00"
                value={formData.margin.toFixed(2)}
                onChange={(e) => handleFormChange('margin', e.target.value)}
                disabled={isLoading}
              />
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      <div className={styles.group}>
        <label className={styles.label}>Notes</label>
        <textarea
          className={styles.textarea}
          rows={2}
          placeholder="Optional note to client"
          value={formData.notes}
          onChange={(e) => handleFormChange('notes', e.target.value)}
          disabled={isLoading}
        />
      </div>

      {/* Submit button */}
      <button type="submit" className={styles.submitBtn} disabled={isLoading}>
        {isLoading ? 'Saving...' : 'Create Invoice'}
      </button>
    </form>
  );
}
