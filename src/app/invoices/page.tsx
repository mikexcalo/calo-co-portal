'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  loadClients,
  loadInvoices,
  Invoice,
  Client,
  currency,
  isoToDisplay,
  daysUntil,
  invSubtotal,
  invTotal,
} from '@/lib/db'
import './invoices.css'

type InvoiceStatus = 'all' | 'paid' | 'unpaid' | 'overdue'

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus>('all')
  const [selectedClient, setSelectedClient] = useState<string>('all')
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const [invoiceData, clientData] = await Promise.all([
          loadInvoices(),
          loadClients(),
        ])
        setInvoices(invoiceData)
        setClients(clientData)
      } catch (error) {
        console.error('Failed to load data:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const getClientName = (clientId: string): string => {
    const client = clients.find((c) => c.id === clientId)
    return client?.name || 'Unknown Client'
  }

  const filteredInvoices = invoices.filter((inv) => {
    // Status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'paid' && inv.status !== 'paid') return false
      if (statusFilter === 'unpaid' && (inv.status === 'paid' || inv.status === 'overdue'))
        return false
      if (statusFilter === 'overdue' && inv.status !== 'overdue') return false
    }

    // Client filter
    if (selectedClient !== 'all' && inv.client_id !== selectedClient) return false

    return true
  })

  const stats = {
    totalBilled: filteredInvoices.reduce((sum, inv) => sum + invTotal(inv), 0),
    paid: filteredInvoices
      .filter((inv) => inv.status === 'paid')
      .reduce((sum, inv) => sum + invTotal(inv), 0),
    outstanding: filteredInvoices
      .filter((inv) => inv.status !== 'paid')
      .reduce((sum, inv) => sum + invTotal(inv), 0),
    count: filteredInvoices.length,
  }

  const toggleRow = (invoiceId: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(invoiceId)) {
      newExpanded.delete(invoiceId)
    } else {
      newExpanded.add(invoiceId)
    }
    setExpandedRows(newExpanded)
  }

  const getStatusClass = (status: Invoice['status']) => {
    switch (status) {
      case 'paid':
        return 'pill-paid'
      case 'overdue':
        return 'pill-overdue'
      default:
        return 'pill-unpaid'
    }
  }

  const getStatusDisplay = (status: Invoice['status']) => {
    return status.charAt(0).toUpperCase() + status.slice(1)
  }

  return (
    <main className="invoices-container">
      <div className="invoices-header">
        <h1>INVOICES</h1>
        <Link href="/invoices/new" className="btn-primary">
          New Invoice
        </Link>
      </div>

      {/* Stats Row */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Billed</div>
          <div className="stat-value">{currency(stats.totalBilled)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Paid</div>
          <div className="stat-value" style={{ color: '#10b981' }}>
            {currency(stats.paid)}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Outstanding</div>
          <div className="stat-value" style={{ color: stats.outstanding > 0 ? '#f59e0b' : '#10b981' }}>
            {currency(stats.outstanding)}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Invoice Count</div>
          <div className="stat-value">{stats.count}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-section">
        <div className="status-tabs">
          {(['all', 'unpaid', 'paid', 'overdue'] as const).map((status) => (
            <button
              key={status}
              className={`tab ${statusFilter === status ? 'active' : ''}`}
              onClick={() => setStatusFilter(status)}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        <select
          className="client-filter"
          value={selectedClient}
          onChange={(e) => setSelectedClient(e.target.value)}
        >
          <option value="all">All Clients</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </div>

      {/* Invoice Table */}
      {loading ? (
        <div className="loading">Loading invoices...</div>
      ) : filteredInvoices.length === 0 ? (
        <div className="empty-state">No invoices found</div>
      ) : (
        <div className="data-table">
          <div className="table-header">
            <div className="col-toggle"></div>
            <div className="col-number">Invoice #</div>
            <div className="col-client">Client</div>
            <div className="col-project">Project</div>
            <div className="col-status">Status</div>
            <div className="col-issued">Issued</div>
            <div className="col-due">Due</div>
            <div className="col-total">Total</div>
          </div>

          {filteredInvoices.map((invoice) => (
            <div key={invoice.id} className="table-row-group">
              <div className="table-row">
                <button
                  className="col-toggle toggle-btn"
                  onClick={() => toggleRow(invoice.id)}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M6 5L10 9L6 13"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      style={{
                        transform: expandedRows.has(invoice.id) ? 'rotate(90deg)' : 'none',
                        transformOrigin: 'center',
                        transition: 'transform 200ms',
                      }}
                    />
                  </svg>
                </button>
                <div className="col-number">{invoice.invoice_number}</div>
                <div className="col-client">{getClientName(invoice.client_id)}</div>
                <div className="col-project">{invoice.project_name || '—'}</div>
                <div className="col-status">
                  <span className={`pill ${getStatusClass(invoice.status)}`}>
                    {getStatusDisplay(invoice.status)}
                  </span>
                </div>
                <div className="col-issued">{isoToDisplay(invoice.issued_date)}</div>
                <div className="col-due">{isoToDisplay(invoice.due_date)}</div>
                <div className="col-total">{currency(invTotal(invoice))}</div>
              </div>

              {expandedRows.has(invoice.id) && (
                <div className="expanded-row">
                  <div className="expanded-content">
                    <div className="expanded-section">
                      <h4>Line Items</h4>
                      {invoice.line_items?.items && invoice.line_items.items.length > 0 ? (
                        <table className="line-items-table">
                          <thead>
                            <tr>
                              <th>Description</th>
                              <th style={{ textAlign: 'right' }}>Qty</th>
                              <th style={{ textAlign: 'right' }}>Price</th>
                              <th style={{ textAlign: 'right' }}>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {invoice.line_items.items.map((item, idx) => (
                              <tr key={idx}>
                                <td>{item.description}</td>
                                <td style={{ textAlign: 'right' }}>{item.quantity}</td>
                                <td style={{ textAlign: 'right' }}>{currency(item.price)}</td>
                                <td style={{ textAlign: 'right' }}>
                                  {currency(item.quantity * item.price)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p>No line items</p>
                      )}
                    </div>

                    <div className="expanded-section">
                      <h4>Totals</h4>
                      <div className="totals-breakdown">
                        <div className="breakdown-row">
                          <span>Subtotal:</span>
                          <span>{currency(invSubtotal(invoice))}</span>
                        </div>
                        {invoice.tax > 0 && (
                          <div className="breakdown-row">
                            <span>Tax:</span>
                            <span>{currency(invoice.tax)}</span>
                          </div>
                        )}
                        {invoice.shipping > 0 && (
                          <div className="breakdown-row">
                            <span>Shipping:</span>
                            <span>{currency(invoice.shipping)}</span>
                          </div>
                        )}
                        <div className="breakdown-row total">
                          <span>Total:</span>
                          <span>{currency(invTotal(invoice))}</span>
                        </div>
                      </div>
                    </div>

                    {invoice.notes && (
                      <div className="expanded-section">
                        <h4>Notes</h4>
                        <p>{invoice.notes}</p>
                      </div>
                    )}

                    {invoice.line_items?.internalNotes && (
                      <div className="expanded-section">
                        <h4>Internal Notes</h4>
                        <p>{invoice.line_items.internalNotes}</p>
                      </div>
                    )}

                    {invoice.internal_margin !== undefined && (
                      <div className="expanded-section">
                        <h4>Internal Margin</h4>
                        <p>{currency(invoice.internal_margin)}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
