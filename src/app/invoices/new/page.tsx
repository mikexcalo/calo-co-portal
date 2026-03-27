'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  loadClients,
  saveInvoice,
  logActivity,
  Client,
  LineItem,
  Invoice,
  initials,
} from '@/lib/db'
import '../invoices.css'
import './new-invoice.css'

interface ExtractedData {
  project_name?: string
  invoice_date?: string
  due_date?: string
  line_items?: Array<{
    description: string
    quantity: number
    price: number
  }>
  subtotal?: number
  tax?: number
  shipping?: number
  total?: number
  notes?: string
}

interface FormData {
  client_id: string
  project_name: string
  invoice_type: 'Service' | 'Reimbursement'
  issue_date: string
  due_date: string
  line_items: LineItem[]
  tax: number
  shipping: number
  notes: string
  internal_margin: number
}

export default function NewInvoicePage() {
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [extracting, setExtracting] = useState(false)
  const [emptyFields, setEmptyFields] = useState<Set<string>>(new Set())
  const dragDropRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState<FormData>({
    client_id: '',
    project_name: '',
    invoice_type: 'Service',
    issue_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    line_items: [{ description: '', quantity: 1, price: 0 }],
    tax: 0,
    shipping: 0,
    notes: '',
    internal_margin: 0,
  })

  const [previews, setPreviews] = useState<string[]>([])

  useEffect(() => {
    async function loadData() {
      try {
        const clientData = await loadClients()
        setClients(clientData)
      } catch (error) {
        console.error('Failed to load clients:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (dragDropRef.current) {
      dragDropRef.current.classList.add('drag-over')
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (dragDropRef.current) {
      dragDropRef.current.classList.remove('drag-over')
    }
  }

  const processFile = async (file: File) => {
    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => {
      if (e.target?.result) {
        setPreviews((prev) => [...prev, e.target!.result as string])
      }
    }
    reader.readAsDataURL(file)

    // Extract data using Claude API
    setExtracting(true)
    try {
      const base64Reader = new FileReader()
      base64Reader.onload = async (e) => {
        const base64 = (e.target?.result as string)?.split(',')[1] || ''
        const mimeType = file.type || 'image/jpeg'

        try {
          const response = await fetch('/api/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageBase64: base64,
              mediaType: mimeType,
            }),
          })

          const extracted: ExtractedData = await response.json()

          // Track which fields were empty
          const empty = new Set<string>()
          if (!extracted.project_name) empty.add('project_name')
          if (!extracted.invoice_date) empty.add('issue_date')
          if (!extracted.due_date) empty.add('due_date')
          if (!extracted.notes) empty.add('notes')
          if (!extracted.line_items || extracted.line_items.length === 0) {
            empty.add('line_items')
          }
          setEmptyFields(empty)

          // Update form with extracted data
          setFormData((prev) => ({
            ...prev,
            project_name: extracted.project_name || prev.project_name,
            issue_date: extracted.invoice_date || prev.issue_date,
            due_date: extracted.due_date || prev.due_date,
            line_items: extracted.line_items || prev.line_items,
            tax: extracted.tax || prev.tax,
            shipping: extracted.shipping || prev.shipping,
            notes: extracted.notes || prev.notes,
          }))
        } catch (error) {
          console.error('Extraction failed:', error)
        } finally {
          setExtracting(false)
        }
      }
      base64Reader.readAsDataURL(file)
    } catch (error) {
      console.error('File processing error:', error)
      setExtracting(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (dragDropRef.current) {
      dragDropRef.current.classList.remove('drag-over')
    }

    const files = e.dataTransfer.files
    if (files.length > 0) {
      const file = files[0]
      if (file.type.startsWith('image/') || file.type === 'application/pdf') {
        processFile(file)
      }
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files
    if (files && files.length > 0) {
      processFile(files[0])
    }
  }

  const generateInvoiceNumber = (): string => {
    const client = clients.find((c) => c.id === formData.client_id)
    if (!client) return 'INV-0000'
    const clientInitials = initials(client.name)
    const timestamp = Date.now().toString().slice(-4)
    return `CC-${clientInitials}-${timestamp}`
  }

  const handleAddLineItem = () => {
    setFormData((prev) => ({
      ...prev,
      line_items: [...prev.line_items, { description: '', quantity: 1, price: 0 }],
    }))
  }

  const handleDeleteLineItem = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      line_items: prev.line_items.filter((_, i) => i !== index),
    }))
  }

  const updateLineItem = (index: number, field: keyof LineItem, value: any) => {
    setFormData((prev) => {
      const newItems = [...prev.line_items]
      newItems[index] = { ...newItems[index], [field]: value }
      return { ...prev, line_items: newItems }
    })
  }

  const subtotal = formData.line_items.reduce((sum, item) => sum + item.quantity * item.price, 0)
  const total = subtotal + formData.tax + formData.shipping

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.client_id || !formData.issue_date || !formData.due_date) {
      alert('Please fill in all required fields')
      return
    }

    try {
      const invoiceNumber = generateInvoiceNumber()

      const invoiceData: Partial<Invoice> = {
        client_id: formData.client_id,
        invoice_number: invoiceNumber,
        project_name: formData.project_name,
        issued_date: formData.issue_date,
        due_date: formData.due_date,
        status: 'sent',
        type: 'invoice',
        line_items: {
          items: formData.line_items,
          isReimbursement: formData.invoice_type === 'Reimbursement',
        },
        tax: formData.tax,
        shipping: formData.shipping,
        notes: formData.notes,
        internal_margin: formData.internal_margin,
      }

      const saved = await saveInvoice(invoiceData)
      if (saved) {
        await logActivity(formData.client_id, 'invoice_created', {
          invoice_number: invoiceNumber,
          total: total,
        })

        router.push('/invoices')
      } else {
        alert('Failed to create invoice')
      }
    } catch (error) {
      console.error('Submit error:', error)
      alert('Error creating invoice')
    }
  }

  if (loading) {
    return <div className="loading">Loading...</div>
  }

  return (
    <main className="new-invoice-container">
      <div className="ni-layout">
        {/* Left: File Drop Zone */}
        <div className="ni-drop-zone" ref={dragDropRef} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
          <div className="drop-content">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <path d="M24 8V32M16 24H32" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <p className="drop-text">Drop invoice image or PDF here</p>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              Choose File
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
          </div>

          {previews.length > 0 && (
            <div className="preview-thumbs">
              {previews.map((preview, idx) => (
                <div key={idx} className="thumb">
                  <img src={preview} alt={`Preview ${idx}`} />
                </div>
              ))}
            </div>
          )}

          {extracting && <div className="extracting-spinner">Extracting...</div>}
        </div>

        {/* Right: Form Panel */}
        <div className="ni-form-panel">
          <h2 className="form-title">New Invoice</h2>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="client">Client *</label>
              <select
                id="client"
                value={formData.client_id}
                onChange={(e) => setFormData((prev) => ({ ...prev, client_id: e.target.value }))}
                className={emptyFields.has('client_id') ? 'highlight-amber' : ''}
              >
                <option value="">Select a client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="project">Project Name</label>
              <input
                id="project"
                type="text"
                placeholder="e.g., Website Redesign"
                value={formData.project_name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, project_name: e.target.value }))
                }
                className={emptyFields.has('project_name') ? 'highlight-amber' : ''}
              />
            </div>

            <div className="form-group">
              <label>Invoice Type</label>
              <div className="toggle-group">
                <button
                  type="button"
                  className={`toggle-btn ${formData.invoice_type === 'Service' ? 'active' : ''}`}
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, invoice_type: 'Service' }))
                  }
                >
                  Service
                </button>
                <button
                  type="button"
                  className={`toggle-btn ${formData.invoice_type === 'Reimbursement' ? 'active' : ''}`}
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, invoice_type: 'Reimbursement' }))
                  }
                >
                  Reimbursement
                </button>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="issue-date">Issue Date *</label>
                <input
                  id="issue-date"
                  type="date"
                  value={formData.issue_date}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, issue_date: e.target.value }))
                  }
                />
              </div>
              <div className="form-group">
                <label htmlFor="due-date">Due Date *</label>
                <input
                  id="due-date"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, due_date: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* Line Items Table */}
            <div className="form-group">
              <label>Line Items</label>
              <div className="line-items-editor">
                <div className="line-items-header">
                  <div className="col-desc">Description</div>
                  <div className="col-qty">Qty</div>
                  <div className="col-price">Unit Price</div>
                  <div className="col-total">Total</div>
                  <div className="col-action"></div>
                </div>

                {formData.line_items.map((item, idx) => (
                  <div key={idx} className="line-item-row">
                    <input
                      type="text"
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => updateLineItem(idx, 'description', e.target.value)}
                      className="col-desc"
                    />
                    <input
                      type="number"
                      placeholder="1"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                      className="col-qty"
                      min="1"
                      step="0.5"
                    />
                    <input
                      type="number"
                      placeholder="0.00"
                      value={item.price}
                      onChange={(e) => updateLineItem(idx, 'price', parseFloat(e.target.value) || 0)}
                      className="col-price"
                      step="0.01"
                    />
                    <div className="col-total">
                      ${(item.quantity * item.price).toFixed(2)}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteLineItem(idx)}
                      className="btn-delete"
                    >
                      ×
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleAddLineItem}
                  className="btn-add-item"
                >
                  + Add Line Item
                </button>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="tax">Tax</label>
                <input
                  id="tax"
                  type="number"
                  placeholder="0.00"
                  value={formData.tax}
                  onChange={(e) => setFormData((prev) => ({ ...prev, tax: parseFloat(e.target.value) || 0 }))}
                  step="0.01"
                />
              </div>
              <div className="form-group">
                <label htmlFor="shipping">Shipping</label>
                <input
                  id="shipping"
                  type="number"
                  placeholder="0.00"
                  value={formData.shipping}
                  onChange={(e) => setFormData((prev) => ({ ...prev, shipping: parseFloat(e.target.value) || 0 }))}
                  step="0.01"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="notes">Notes</label>
              <textarea
                id="notes"
                placeholder="Payment terms, special instructions, etc."
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="form-group">
              <label htmlFor="margin">Internal Margin</label>
              <input
                id="margin"
                type="number"
                placeholder="0.00"
                value={formData.internal_margin}
                onChange={(e) => setFormData((prev) => ({ ...prev, internal_margin: parseFloat(e.target.value) || 0 }))}
                step="0.01"
              />
            </div>

            {/* Totals Summary */}
            <div className="totals-summary">
              <div className="summary-row">
                <span>Subtotal:</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              {formData.tax > 0 && (
                <div className="summary-row">
                  <span>Tax:</span>
                  <span>${formData.tax.toFixed(2)}</span>
                </div>
              )}
              {formData.shipping > 0 && (
                <div className="summary-row">
                  <span>Shipping:</span>
                  <span>${formData.shipping.toFixed(2)}</span>
                </div>
              )}
              <div className="summary-row total">
                <span>Grand Total:</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>

            <button type="submit" className="btn-primary btn-submit" disabled={extracting}>
              Create Invoice
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
