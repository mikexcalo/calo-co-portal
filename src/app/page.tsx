'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  loadClients,
  loadInvoices,
  loadAllContacts,
  loadExpenses,
  loadActivityLog,
  loadAgencySettings,
  Client,
  Invoice,
  Contact,
  Expense,
  ActivityLogEntry,
  AgencySettings,
  currency,
  initials,
  daysUntil,
  invTotal,
} from '@/lib/db'

export default function Dashboard() {
  // State management
  const [time, setTime] = useState<string>('')
  const [clients, setClients] = useState<Client[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([])
  const [agencySettings, setAgencySettings] = useState<AgencySettings | null>(null)
  const [loading, setLoading] = useState(true)

  // Expanded tile states
  const [expandedTiles, setExpandedTiles] = useState<{ [key: string]: boolean }>({
    invoices: false,
    financials: false,
    clients: false,
  })

  // Client filter state
  const [clientFilter, setClientFilter] = useState<'active' | 'paused' | 'archived'>('active')

  // Load data on mount
  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const [clientsData, invoicesData, contactsData, expensesData, activityData, settingsData] =
          await Promise.all([
            loadClients(),
            loadInvoices(),
            loadAllContacts(),
            loadExpenses(),
            loadActivityLog(30),
            loadAgencySettings(),
          ])

        setClients(clientsData)
        setInvoices(invoicesData)
        setContacts(contactsData)
        setExpenses(expensesData)
        setActivityLog(activityData)
        setAgencySettings(settingsData)
      } catch (error) {
        console.error('Failed to load dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  // Live clock effect
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      const hours = String(now.getHours()).padStart(2, '0')
      const minutes = String(now.getMinutes()).padStart(2, '0')
      const ampm = now.getHours() >= 12 ? 'PM' : 'AM'
      setTime(`${hours}:${minutes} ${ampm}`)
    }

    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  // Helper functions
  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }

  const calculateInvoiceMetrics = () => {
    let totalBilled = 0
    let outstanding = 0
    let paid = 0

    invoices.forEach((inv) => {
      const total = invTotal(inv)
      totalBilled += total

      if (inv.status === 'paid') {
        paid += total
      } else if (inv.status === 'draft') {
        outstanding += total
      } else if (inv.status === 'sent' || inv.status === 'overdue') {
        outstanding += total
      }
    })

    return { totalBilled, outstanding, paid }
  }

  const calculateFinancialMetrics = () => {
    let grossRevenue = 0
    let totalExpenses = 0

    invoices.forEach((inv) => {
      if (inv.status === 'paid' || inv.status === 'sent') {
        grossRevenue += invTotal(inv)
      }
    })

    expenses.forEach((exp) => {
      totalExpenses += exp.amount
    })

    const netIncome = grossRevenue - totalExpenses

    return { grossRevenue, totalExpenses, netIncome }
  }

  const getActiveClientCount = () => {
    return clients.filter((c) => c.engagement_status === 'active').length
  }

  const getTotalModules = () => {
    return clients.reduce((sum, client) => sum + (client.active_modules?.length || 0), 0)
  }

  const getNeedsAttentionItems = () => {
    const items = []

    // Check for incomplete data and overdue invoices
    clients.forEach((client) => {
      const clientInvoices = invoices.filter((inv) => inv.client_id === client.id)
      const clientContacts = contacts.filter((con) => con.client_id === client.id)

      // Check for missing data
      if (!clientContacts.length) {
        items.push({
          type: 'missing-contacts',
          clientId: client.id,
          clientName: client.name,
          reason: 'No contacts added',
          dot: 'amber',
        })
      }

      // Check for overdue invoices
      const overdueInvoices = clientInvoices.filter((inv) => inv.status === 'overdue')
      if (overdueInvoices.length > 0) {
        items.push({
          type: 'overdue-invoice',
          clientId: client.id,
          clientName: client.name,
          reason: `${overdueInvoices.length} overdue invoice${overdueInvoices.length > 1 ? 's' : ''}`,
          dot: 'red',
        })
      }
    })

    return items.slice(0, 5)
  }

  const getFilteredClients = () => {
    if (clientFilter === 'active') {
      return clients.filter((c) => c.engagement_status === 'active')
    } else if (clientFilter === 'paused') {
      return clients.filter((c) => c.engagement_status === 'inactive')
    } else {
      return clients.filter((c) => c.engagement_status === 'prospect')
    }
  }

  const getRecentActivity = () => {
    return activityLog.slice(0, 6).map((activity) => {
      let borderColor = 'border-blue-500'
      let title = activity.event_type

      if (activity.event_type.includes('overdue')) {
        borderColor = 'border-red-500'
        title = 'Overdue Invoice'
      } else if (activity.event_type.includes('paid')) {
        borderColor = 'border-green-500'
        title = 'Invoice Paid'
      } else if (activity.event_type.includes('invoice')) {
        borderColor = 'border-blue-500'
        title = 'Invoice Created'
      }

      return {
        id: activity.id,
        title,
        borderColor,
        time: activity.created_at,
        clientId: activity.client_id,
      }
    })
  }

  const getClientName = (clientId: string) => {
    return clients.find((c) => c.id === clientId)?.name || 'Unknown'
  }

  const formatTimeAgo = (isoDate: string) => {
    const date = new Date(isoDate)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  const toggleTile = (tile: string) => {
    setExpandedTiles((prev) => ({
      ...prev,
      [tile]: !prev[tile],
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  const invoiceMetrics = calculateInvoiceMetrics()
  const financialMetrics = calculateFinancialMetrics()
  const filteredClients = getFilteredClients()
  const needsAttention = getNeedsAttentionItems()
  const recentActivity = getRecentActivity()

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-[980px] mx-auto px-6 py-8 pb-[60px]">
        {/* Greeting with Live Clock */}
        <div className="mb-12">
          <h1 className="text-3xl font-bold text-gray-900">
            {getGreeting()},
            <br />
            <span className="text-lg font-normal text-gray-600">{time}</span>
          </h1>
        </div>

        {/* Three Agency Tiles */}
        <div className="flex gap-12 mb-12">
          {/* INVOICES Tile */}
          <div className="flex-1 bg-white border border-[#e8e8e8] rounded-[10px] p-[14px_16px] transition-all hover:border-[#bbb] hover:shadow-lg">
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => toggleTile('invoices')}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">📄</span>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">INVOICES</h3>
                  <p className="text-xs text-gray-600">{currency(invoiceMetrics.totalBilled)}</p>
                </div>
              </div>
              <span
                className={`text-lg transition-transform ${expandedTiles.invoices ? 'rotate-180' : ''}`}
              >
                ▾
              </span>
            </div>

            {expandedTiles.invoices && (
              <>
                <div className="border-t border-[#e8e8e8] my-3"></div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Billed:</span>
                    <span className="font-semibold text-gray-900">{currency(invoiceMetrics.totalBilled)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Outstanding:</span>
                    <span
                      className={`font-semibold ${
                        invoiceMetrics.outstanding > 0 ? 'text-amber-600' : 'text-green-600'
                      }`}
                    >
                      {currency(invoiceMetrics.outstanding)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Paid:</span>
                    <span className="font-semibold text-green-600">{currency(invoiceMetrics.paid)}</span>
                  </div>
                </div>
                <Link
                  href="/invoices"
                  className="block mt-3 text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  View all →
                </Link>
              </>
            )}
          </div>

          {/* FINANCIALS Tile */}
          <div className="flex-1 bg-white border border-[#e8e8e8] rounded-[10px] p-[14px_16px] transition-all hover:border-[#bbb] hover:shadow-lg">
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => toggleTile('financials')}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">💰</span>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">FINANCIALS</h3>
                  <p
                    className={`text-xs font-medium ${
                      financialMetrics.netIncome >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {currency(financialMetrics.netIncome)}
                  </p>
                </div>
              </div>
              <span
                className={`text-lg transition-transform ${expandedTiles.financials ? 'rotate-180' : ''}`}
              >
                ▾
              </span>
            </div>

            {expandedTiles.financials && (
              <>
                <div className="border-t border-[#e8e8e8] my-3"></div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Gross Revenue:</span>
                    <span className="font-semibold text-gray-900">
                      {currency(financialMetrics.grossRevenue)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Expenses:</span>
                    <span className="font-semibold text-gray-900">
                      {currency(financialMetrics.totalExpenses)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Net Income:</span>
                    <span
                      className={`font-semibold ${
                        financialMetrics.netIncome >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {currency(financialMetrics.netIncome)}
                    </span>
                  </div>
                </div>
                <Link
                  href="/financials"
                  className="block mt-3 text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  View all →
                </Link>
              </>
            )}
          </div>

          {/* CLIENTS Tile */}
          <div className="flex-1 bg-white border border-[#e8e8e8] rounded-[10px] p-[14px_16px] transition-all hover:border-[#bbb] hover:shadow-lg">
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => toggleTile('clients')}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">👥</span>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">CLIENTS</h3>
                  <p className="text-xs text-gray-600">{getActiveClientCount()} active</p>
                </div>
              </div>
              <span
                className={`text-lg transition-transform ${expandedTiles.clients ? 'rotate-180' : ''}`}
              >
                ▾
              </span>
            </div>

            {expandedTiles.clients && (
              <>
                <div className="border-t border-[#e8e8e8] my-3"></div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Active:</span>
                    <span className="font-semibold text-gray-900">{getActiveClientCount()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Clients:</span>
                    <span className="font-semibold text-gray-900">{clients.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Modules:</span>
                    <span className="font-semibold text-gray-900">{getTotalModules()}</span>
                  </div>
                </div>
                <Link
                  href="/clients"
                  className="block mt-3 text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  View all →
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Attention Strip */}
        {needsAttention.length > 0 && (
          <div className="mb-12 bg-white border border-[#fde68a] rounded-[10px] p-[14px_18px]">
            <h3 className="text-xs font-bold text-amber-700 mb-3 uppercase tracking-wider">
              ⚠ Needs Attention
            </h3>
            <div className="space-y-2">
              {needsAttention.map((item, idx) => (
                <Link
                  key={idx}
                  href={`/clients/${item.clientId}`}
                  className="flex items-center gap-3 text-sm text-gray-700 hover:text-blue-600 transition-colors"
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      item.dot === 'red' ? 'bg-red-500' : 'bg-amber-500'
                    }`}
                  ></span>
                  <span className="flex-1">{item.clientName}</span>
                  <span className="text-xs text-gray-500">{item.reason}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Client List with Filter Tabs */}
        <div className="mb-12">
          <h2 className="text-xs font-bold text-gray-600 mb-4 uppercase tracking-wider">Clients</h2>

          {/* Filter Tabs */}
          <div className="flex gap-2 mb-4">
            {(['active', 'paused', 'archived'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setClientFilter(filter)}
                className={`px-[14px] py-[5px] rounded-md text-sm font-medium transition-all ${
                  clientFilter === filter
                    ? 'bg-blue-500 text-white'
                    : 'bg-[#f1f5f9] text-[#64748b] hover:bg-blue-50'
                }`}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </button>
            ))}
          </div>

          {/* Client Cards */}
          <div className="space-y-3">
            {filteredClients.length > 0 ? (
              filteredClients.map((client) => {
                const clientContacts = contacts.filter((c) => c.client_id === client.id)
                const primaryContact = clientContacts.find((c) => c.is_primary) || clientContacts[0]
                const hasIncompleteData =
                  !clientContacts.length ||
                  invoices.some((inv) => inv.client_id === client.id && inv.status === 'overdue')

                return (
                  <Link
                    key={client.id}
                    href={`/clients/${client.id}`}
                    className="flex items-center gap-4 p-[12px_16px] bg-white border border-[#e8e8e8] rounded-[10px] transition-all hover:border-[#bbb] hover:shadow-md"
                  >
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-lg bg-[#e2e8f0] flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-semibold text-gray-700">{initials(client.name)}</span>
                    </div>

                    {/* Client Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-gray-900">{client.name}</p>
                      <p className="text-[11.5px] text-[#94a3b8]">
                        {primaryContact?.name || 'No contact'}
                      </p>
                    </div>

                    {/* Status Badge */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {hasIncompleteData && (
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      )}
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded ${
                          client.engagement_status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : client.engagement_status === 'inactive'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {client.engagement_status.charAt(0).toUpperCase() +
                          client.engagement_status.slice(1)}
                      </span>
                    </div>
                  </Link>
                )
              })
            ) : (
              <p className="text-sm text-gray-500 text-center py-8">No clients in this category</p>
            )}
          </div>
        </div>

        {/* Activity Feed */}
        <div>
          <h2 className="text-xs font-bold text-gray-600 mb-4 uppercase tracking-wider">
            Recent Activity
          </h2>
          <div className="space-y-3">
            {recentActivity.length > 0 ? (
              recentActivity.map((activity) => (
                <Link
                  key={activity.id}
                  href={`/clients/${activity.clientId}`}
                  className={`flex gap-4 p-3 bg-white border-l-4 rounded transition-all hover:shadow-md ${activity.borderColor}`}
                >
                  <div className="flex-1">
                    <p className="text-[12px] font-bold text-gray-900">{activity.title}</p>
                    <p className="text-[11px] text-[#94a3b8] mt-1">
                      {getClientName(activity.clientId)} • {formatTimeAgo(activity.time)}
                    </p>
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-sm text-gray-500 text-center py-8">No recent activity</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
