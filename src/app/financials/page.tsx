'use client'

import React, { useState, useEffect } from 'react'
import {
  loadClients,
  loadInvoices,
  loadExpenses,
  loadAgencySettings,
  saveExpense,
  currency,
  isoToDisplay,
  Client,
  Invoice,
  Expense,
  AgencySettings,
} from '@/lib/db'
import Link from 'next/link'

type PeriodType = 'month' | 'quarter' | 'year' | 'allTime'

interface ExpenseRow extends Expense {
  clientName?: string
}

interface RevenueByClient {
  clientId: string
  clientName: string
  invoiceCount: number
  collected: number
  total: number
  percentOfRevenue: number
}

export default function FinancialsPage() {
  const [period, setPeriod] = useState<PeriodType>('month')
  const [clients, setClients] = useState<Client[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [expenses, setExpenses] = useState<ExpenseRow[]>([])
  const [settings, setSettings] = useState<AgencySettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [expenseForm, setExpenseForm] = useState({
    date: new Date().toISOString().split('T')[0],
    category: 'Other',
    vendor: '',
    description: '',
    amount: '',
    linkedClient: '',
    linkedInvoice: '',
    notes: '',
  })

  const categoryColors: Record<string, { bg: string; text: string }> = {
    Contractor: { bg: 'bg-[#ede9fe]', text: 'text-[#5b21b6]' },
    Software: { bg: 'bg-[#dbeafe]', text: 'text-[#1d4ed8]' },
    Materials: { bg: 'bg-[#dcfce7]', text: 'text-[#15803d]' },
    Travel: { bg: 'bg-[#fef3c7]', text: 'text-[#92400e]' },
    Other: { bg: 'bg-[#f1f5f9]', text: 'text-[#475569]' },
  }

  useEffect(() => {
    const loadData = async () => {
      try {
        const [clientsData, invoicesData, expensesData, settingsData] = await Promise.all([
          loadClients(),
          loadInvoices(),
          loadExpenses(),
          loadAgencySettings(),
        ])

        setClients(clientsData)
        setInvoices(invoicesData)
        setSettings(settingsData)

        // Enrich expenses with client names
        const enrichedExpenses = expensesData.map((exp) => ({
          ...exp,
          clientName: clientsData.find((c) => c.id === exp.client_id)?.name || 'Unknown',
        }))
        setExpenses(enrichedExpenses)
      } catch (error) {
        console.error('Failed to load financials data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const getDateRange = (): { start: Date; end: Date } => {
    const today = new Date()
    const start = new Date()

    switch (period) {
      case 'month':
        start.setMonth(today.getMonth())
        start.setDate(1)
        break
      case 'quarter':
        start.setMonth(Math.floor(today.getMonth() / 3) * 3)
        start.setDate(1)
        break
      case 'year':
        start.setFullYear(today.getFullYear())
        start.setMonth(0)
        start.setDate(1)
        break
      case 'allTime':
        start.setFullYear(1970)
        break
    }

    return { start, end: today }
  }

  const filterByPeriod = (items: any[], dateField: string) => {
    const { start, end } = getDateRange()
    return items.filter((item) => {
      const itemDate = new Date(item[dateField])
      return itemDate >= start && itemDate <= end
    })
  }

  const filteredInvoices = filterByPeriod(invoices, 'issued_date')
  const filteredExpenses = filterByPeriod(expenses, 'date')

  // Calculate revenue
  const totalRevenue = filteredInvoices.reduce((sum, inv) => {
    const subtotal = (inv.line_items?.items || []).reduce(
      (s: number, item: any) => s + item.quantity * item.price,
      0
    )
    return sum + subtotal + (inv.tax || 0) + (inv.shipping || 0)
  }, 0)

  const serviceRevenue = filteredInvoices
    .filter((inv) => !inv.line_items?.isReimbursement)
    .reduce((sum, inv) => {
      const subtotal = (inv.line_items?.items || []).reduce(
        (s: number, item: any) => s + item.quantity * item.price,
        0
      )
      return sum + subtotal + (inv.tax || 0) + (inv.shipping || 0)
    }, 0)

  const passThroughRevenue = filteredInvoices
    .filter((inv) => inv.line_items?.isReimbursement)
    .reduce((sum, inv) => {
      const subtotal = (inv.line_items?.items || []).reduce(
        (s: number, item: any) => s + item.quantity * item.price,
        0
      )
      return sum + subtotal + (inv.tax || 0) + (inv.shipping || 0)
    }, 0)

  // Calculate expenses by category
  const expensesByCategory = {
    Contractor: filteredExpenses
      .filter((e) => e.category === 'Contractor')
      .reduce((sum, e) => sum + e.amount, 0),
    Software: filteredExpenses
      .filter((e) => e.category === 'Software')
      .reduce((sum, e) => sum + e.amount, 0),
    Materials: filteredExpenses
      .filter((e) => e.category === 'Materials')
      .reduce((sum, e) => sum + e.amount, 0),
    Travel: filteredExpenses
      .filter((e) => e.category === 'Travel')
      .reduce((sum, e) => sum + e.amount, 0),
    Other: filteredExpenses
      .filter((e) => e.category === 'Other')
      .reduce((sum, e) => sum + e.amount, 0),
  }

  const totalExpenses = Object.values(expensesByCategory).reduce((sum, val) => sum + val, 0)
  const netIncome = totalRevenue - totalExpenses
  const taxRate = settings?.tax_rate || 25
  const taxEstimate = Math.max(0, netIncome * (taxRate / 100))
  const takeHome = netIncome - taxEstimate

  // Revenue by client
  const revenueByClient: RevenueByClient[] = clients
    .map((client) => {
      const clientInvoices = filteredInvoices.filter((inv) => inv.client_id === client.id)
      const clientTotal = clientInvoices.reduce((sum, inv) => {
        const subtotal = (inv.line_items?.items || []).reduce(
          (s: number, item: any) => s + item.quantity * item.price,
          0
        )
        return sum + subtotal + (inv.tax || 0) + (inv.shipping || 0)
      }, 0)
      const collected = clientInvoices
        .filter((inv) => inv.status === 'paid')
        .reduce((sum, inv) => {
          const subtotal = (inv.line_items?.items || []).reduce(
            (s: number, item: any) => s + item.quantity * item.price,
            0
          )
          return sum + subtotal + (inv.tax || 0) + (inv.shipping || 0)
        }, 0)

      return {
        clientId: client.id,
        clientName: client.name,
        invoiceCount: clientInvoices.length,
        collected,
        total: clientTotal,
        percentOfRevenue: totalRevenue > 0 ? (clientTotal / totalRevenue) * 100 : 0,
      }
    })
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total)

  const handleSaveExpense = async () => {
    if (!expenseForm.vendor || !expenseForm.amount) {
      alert('Please fill in vendor and amount')
      return
    }

    try {
      await saveExpense({
        date: expenseForm.date,
        category: expenseForm.category,
        paid_to: expenseForm.vendor,
        description: expenseForm.description,
        amount: parseFloat(expenseForm.amount),
        client_id: expenseForm.linkedClient || '',
        invoice_id: expenseForm.linkedInvoice || undefined,
        notes: expenseForm.notes || undefined,
      })

      setExpenseForm({
        date: new Date().toISOString().split('T')[0],
        category: 'Other',
        vendor: '',
        description: '',
        amount: '',
        linkedClient: '',
        linkedInvoice: '',
        notes: '',
      })
      setShowExpenseModal(false)

      // Reload expenses
      const expensesData = await loadExpenses()
      const enrichedExpenses = expensesData.map((exp) => ({
        ...exp,
        clientName: clients.find((c) => c.id === exp.client_id)?.name || 'Unknown',
      }))
      setExpenses(enrichedExpenses)
    } catch (error) {
      console.error('Failed to save expense:', error)
      alert('Failed to save expense')
    }
  }

  if (loading) {
    return <div className="p-8">Loading...</div>
  }

  return (
    <div className="max-w-[980px] mx-auto px-6 py-8 pb-[60px]">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-6">FINANCIALS</h1>

        {/* Period Selector */}
        <div className="flex gap-2 w-fit border-[1.5px] border-[#e2e8f0] rounded-[7px] overflow-hidden bg-white">
          {(['month', 'quarter', 'year', 'allTime'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 font-medium transition-colors ${
                period === p
                  ? 'bg-[#0f172a] text-white'
                  : 'bg-transparent text-[#64748b] hover:text-[#0f172a]'
              }`}
            >
              {p === 'month' && 'Month'}
              {p === 'quarter' && 'Quarter'}
              {p === 'year' && 'Year'}
              {p === 'allTime' && 'All Time'}
            </button>
          ))}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-6">
          <div className="text-[#64748b] text-sm font-medium mb-2">GROSS REVENUE</div>
          <div className="text-2xl font-bold text-[#0f172a]">{currency(totalRevenue)}</div>
        </div>
        <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-6">
          <div className="text-[#64748b] text-sm font-medium mb-2">TOTAL EXPENSES</div>
          <div className="text-2xl font-bold text-[#0f172a]">{currency(totalExpenses)}</div>
        </div>
        <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-6">
          <div className="text-[#64748b] text-sm font-medium mb-2">NET INCOME</div>
          <div className={`text-2xl font-bold ${netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {currency(netIncome)}
          </div>
        </div>
        <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-6">
          <div className="text-[#64748b] text-sm font-medium mb-2">EST. TAX</div>
          <div className="text-2xl font-bold text-[#0f172a]">{currency(taxEstimate)}</div>
        </div>
      </div>

      {/* P&L Section */}
      <div className="bg-white rounded-[10px] p-6 mb-8 border border-[#e2e8f0]">
        <h2 className="text-lg font-bold mb-6">PROFIT & LOSS</h2>

        <div className="space-y-3">
          {/* Revenue */}
          <div className="flex justify-between text-[#64748b]">
            <span>Service Revenue</span>
            <span>{currency(serviceRevenue)}</span>
          </div>
          <div className="flex justify-between text-[#64748b]">
            <span>Pass-through Revenue</span>
            <span>{currency(passThroughRevenue)}</span>
          </div>
          <div className="flex justify-between font-semibold border-b border-[#e2e8f0] pb-3">
            <span>Total Revenue</span>
            <span>{currency(totalRevenue)}</span>
          </div>

          {/* Expenses */}
          <div className="pt-3 space-y-2">
            {Object.entries(expensesByCategory).map(
              ([category, amount]) =>
                amount > 0 && (
                  <div key={category} className="flex justify-between text-[#64748b]">
                    <span>{category}</span>
                    <span>{currency(amount)}</span>
                  </div>
                )
            )}
            <div className="flex justify-between font-semibold border-b border-[#e2e8f0] pb-3">
              <span>Total Expenses</span>
              <span>{currency(totalExpenses)}</span>
            </div>
          </div>

          {/* Net Income */}
          <div className="flex justify-between font-bold text-lg border-t-2 border-[#0f172a] pt-3 mb-3">
            <span>Net Income</span>
            <span className={netIncome >= 0 ? 'text-green-600' : 'text-red-600'}>
              {currency(netIncome)}
            </span>
          </div>

          {/* Tax */}
          <div className="flex justify-between text-[#64748b] text-sm">
            <span>Tax Estimate ({taxRate}%)</span>
            <span>{currency(taxEstimate)}</span>
          </div>

          {/* Take Home */}
          <div className="flex justify-between font-bold text-lg">
            <span>Take-Home</span>
            <span className={takeHome >= 0 ? 'text-green-600' : 'text-red-600'}>
              {currency(takeHome)}
            </span>
          </div>
        </div>
      </div>

      {/* Expenses Section */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">EXPENSES</h2>
          <button
            onClick={() => setShowExpenseModal(true)}
            className="px-4 py-2 bg-[#0f172a] text-white rounded-[7px] font-medium hover:bg-[#1e293b] transition-colors"
          >
            Log Expense
          </button>
        </div>

        <div className="bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden">
          <div className="grid grid-cols-5 gap-4 p-4 bg-[#f8fafc] border-b border-[#e2e8f0] font-medium text-sm">
            <div>Date</div>
            <div>Category</div>
            <div>Vendor</div>
            <div>Description</div>
            <div className="text-right">Amount</div>
          </div>

          {filteredExpenses.length === 0 ? (
            <div className="p-8 text-center text-[#64748b]">No expenses logged</div>
          ) : (
            filteredExpenses.map((expense) => {
              const colors = categoryColors[expense.category] || categoryColors['Other']
              return (
                <div
                  key={expense.id}
                  className="grid grid-cols-5 gap-4 p-4 border-b border-[#e2e8f0] last:border-b-0 items-center"
                >
                  <div className="text-sm">{isoToDisplay(expense.date)}</div>
                  <div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${colors.bg} ${colors.text}`}>
                      {expense.category}
                    </span>
                  </div>
                  <div className="text-sm font-medium">{expense.paid_to}</div>
                  <div className="text-sm text-[#64748b]">{expense.description}</div>
                  <div className="text-right font-medium text-sm">{currency(expense.amount)}</div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Revenue by Client Table */}
      <div className="mb-8">
        <h2 className="text-lg font-bold mb-4">REVENUE BY CLIENT</h2>
        <div className="bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden">
          <div className="grid grid-cols-5 gap-4 p-4 bg-[#f8fafc] border-b border-[#e2e8f0] font-medium text-sm">
            <div>Client</div>
            <div>Invoices</div>
            <div>Collected</div>
            <div>Total</div>
            <div className="text-right">% of Revenue</div>
          </div>

          {revenueByClient.length === 0 ? (
            <div className="p-8 text-center text-[#64748b]">No revenue data</div>
          ) : (
            revenueByClient.map((item) => (
              <div
                key={item.clientId}
                className="grid grid-cols-5 gap-4 p-4 border-b border-[#e2e8f0] last:border-b-0 items-center"
              >
                <div className="text-sm font-medium">
                  <Link href={`/clients/${item.clientId}`} className="text-[#0f172a] hover:underline">
                    {item.clientName}
                  </Link>
                </div>
                <div className="text-sm text-[#64748b]">{item.invoiceCount}</div>
                <div className="text-sm font-medium">{currency(item.collected)}</div>
                <div className="text-sm font-medium">{currency(item.total)}</div>
                <div className="text-right text-sm text-[#64748b]">{item.percentOfRevenue.toFixed(1)}%</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Log Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[10px] p-8 max-w-md w-full">
            <h3 className="text-xl font-bold mb-6">Log Expense</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Date</label>
                <input
                  type="date"
                  value={expenseForm.date}
                  onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                  className="w-full border border-[#e2e8f0] rounded-[7px] px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                  className="w-full border border-[#e2e8f0] rounded-[7px] px-3 py-2"
                >
                  <option>Contractor</option>
                  <option>Software</option>
                  <option>Materials</option>
                  <option>Travel</option>
                  <option>Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Vendor</label>
                <input
                  type="text"
                  value={expenseForm.vendor}
                  onChange={(e) => setExpenseForm({ ...expenseForm, vendor: e.target.value })}
                  className="w-full border border-[#e2e8f0] rounded-[7px] px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <input
                  type="text"
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  className="w-full border border-[#e2e8f0] rounded-[7px] px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  className="w-full border border-[#e2e8f0] rounded-[7px] px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Linked Client (Optional)</label>
                <select
                  value={expenseForm.linkedClient}
                  onChange={(e) => setExpenseForm({ ...expenseForm, linkedClient: e.target.value })}
                  className="w-full border border-[#e2e8f0] rounded-[7px] px-3 py-2"
                >
                  <option value="">None</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Linked Invoice (Optional)</label>
                <select
                  value={expenseForm.linkedInvoice}
                  onChange={(e) => setExpenseForm({ ...expenseForm, linkedInvoice: e.target.value })}
                  className="w-full border border-[#e2e8f0] rounded-[7px] px-3 py-2"
                >
                  <option value="">None</option>
                  {invoices.map((invoice) => (
                    <option key={invoice.id} value={invoice.id}>
                      {invoice.invoice_number}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Notes (Optional)</label>
                <textarea
                  value={expenseForm.notes}
                  onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                  className="w-full border border-[#e2e8f0] rounded-[7px] px-3 py-2"
                  rows={3}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  onClick={handleSaveExpense}
                  className="flex-1 bg-[#0f172a] text-white rounded-[7px] py-2 font-medium hover:bg-[#1e293b] transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => setShowExpenseModal(false)}
                  className="flex-1 border border-[#e2e8f0] rounded-[7px] py-2 font-medium hover:bg-[#f8fafc] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
