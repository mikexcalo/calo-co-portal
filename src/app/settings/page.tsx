'use client'

import React, { useState, useEffect } from 'react'
import { loadAgencySettings, saveAgencySettings, AgencySettings } from '@/lib/db'

interface PaymentMethod {
  name: string
  details?: string
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<AgencySettings | null>(null)
  const [editingPaymentMethod, setEditingPaymentMethod] = useState<PaymentMethod | null>(null)
  const [paymentMethodForm, setPaymentMethodForm] = useState({ name: '', details: '' })
  const [showAddPaymentMethod, setShowAddPaymentMethod] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [saveMessage, setSaveMessage] = useState('')

  // Form state
  const [agencyName, setAgencyName] = useState('')
  const [founderName, setFounderName] = useState('')
  const [website, setWebsite] = useState('')
  const [city, setCity] = useState('')
  const [taxRate, setTaxRate] = useState('25')
  const [fiscalYearStart, setFiscalYearStart] = useState('1')
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])

  useEffect(() => {
    const loadData = async () => {
      try {
        const settingsData = await loadAgencySettings()
        if (settingsData) {
          setSettings(settingsData)
          setAgencyName(settingsData.agency_name || '')
          setFounderName(settingsData.founder_name || '')
          setWebsite(settingsData.website || '')
          setCity(settingsData.city || '')
          setTaxRate(String(settingsData.tax_rate || 25))
          setFiscalYearStart(settingsData.fiscal_year_start || '1')
          setPaymentMethods(settingsData.payment_methods || [])
        }

        // Load API key from localStorage
        const savedApiKey = localStorage.getItem('ANTHROPIC_API_KEY') || ''
        setApiKey(savedApiKey)
      } catch (error) {
        console.error('Failed to load settings:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const handleSaveAgencyProfile = async () => {
    try {
      setSaveMessage('')
      await saveAgencySettings({
        agency_name: agencyName,
        founder_name: founderName,
        website: website || undefined,
        city: city,
      })
      setSaveMessage('Agency profile saved successfully')
      setTimeout(() => setSaveMessage(''), 3000)
    } catch (error) {
      console.error('Failed to save agency profile:', error)
      setSaveMessage('Failed to save agency profile')
    }
  }

  const handleSaveTaxSettings = async () => {
    try {
      setSaveMessage('')
      await saveAgencySettings({
        tax_rate: parseFloat(taxRate),
        fiscal_year_start: fiscalYearStart,
      })
      setSaveMessage('Tax settings saved successfully')
      setTimeout(() => setSaveMessage(''), 3000)
    } catch (error) {
      console.error('Failed to save tax settings:', error)
      setSaveMessage('Failed to save tax settings')
    }
  }

  const handleAddPaymentMethod = () => {
    if (!paymentMethodForm.name) {
      alert('Please enter a payment method name')
      return
    }

    const newMethods = [...paymentMethods, paymentMethodForm]
    setPaymentMethods(newMethods)
    setPaymentMethodForm({ name: '', details: '' })
    setShowAddPaymentMethod(false)
  }

  const handleUpdatePaymentMethod = () => {
    if (!editingPaymentMethod || !paymentMethodForm.name) {
      alert('Please enter a payment method name')
      return
    }

    const updatedMethods = paymentMethods.map((pm) =>
      pm.name === editingPaymentMethod.name ? paymentMethodForm : pm
    )
    setPaymentMethods(updatedMethods)
    setPaymentMethodForm({ name: '', details: '' })
    setEditingPaymentMethod(null)
  }

  const handleRemovePaymentMethod = (name: string) => {
    setPaymentMethods(paymentMethods.filter((pm) => pm.name !== name))
  }

  const handleSavePaymentMethods = async () => {
    try {
      setSaveMessage('')
      await saveAgencySettings({
        payment_methods: paymentMethods,
      })
      setSaveMessage('Payment methods saved successfully')
      setTimeout(() => setSaveMessage(''), 3000)
    } catch (error) {
      console.error('Failed to save payment methods:', error)
      setSaveMessage('Failed to save payment methods')
    }
  }

  const handleSaveApiKey = () => {
    try {
      localStorage.setItem('ANTHROPIC_API_KEY', apiKey)
      setSaveMessage('API key saved successfully (stored locally)')
      setTimeout(() => setSaveMessage(''), 3000)
    } catch (error) {
      console.error('Failed to save API key:', error)
      setSaveMessage('Failed to save API key')
    }
  }

  if (loading) {
    return <div className="p-8">Loading...</div>
  }

  return (
    <div className="max-w-[980px] mx-auto px-6 py-8 pb-[60px]">
      {/* Header */}
      <h1 className="text-4xl font-bold mb-8">SETTINGS</h1>

      {/* Save Message */}
      {saveMessage && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-[7px] text-blue-800 text-sm">
          {saveMessage}
        </div>
      )}

      {/* Agency Profile Section */}
      <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-6 mb-8">
        <h2 className="text-lg font-bold mb-6">Agency Profile</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Agency Name</label>
            <input
              type="text"
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
              className="w-full border border-[#e2e8f0] rounded-[7px] px-4 py-2 text-sm"
              placeholder="Enter agency name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Founder Name</label>
            <input
              type="text"
              value={founderName}
              onChange={(e) => setFounderName(e.target.value)}
              className="w-full border border-[#e2e8f0] rounded-[7px] px-4 py-2 text-sm"
              placeholder="Enter founder name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Website</label>
            <input
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="w-full border border-[#e2e8f0] rounded-[7px] px-4 py-2 text-sm"
              placeholder="https://example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">City/Location</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full border border-[#e2e8f0] rounded-[7px] px-4 py-2 text-sm"
              placeholder="Enter city"
            />
          </div>

          <div className="pt-4">
            <button
              onClick={handleSaveAgencyProfile}
              className="px-6 py-2 bg-[#0f172a] text-white rounded-[7px] font-medium hover:bg-[#1e293b] transition-colors"
            >
              Save Profile
            </button>
          </div>
        </div>
      </div>

      {/* Tax & Fiscal Settings */}
      <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-6 mb-8">
        <h2 className="text-lg font-bold mb-6">Tax & Fiscal Settings</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Tax Estimate Rate (%)</label>
            <input
              type="number"
              step="0.01"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              className="w-full border border-[#e2e8f0] rounded-[7px] px-4 py-2 text-sm max-w-xs"
              placeholder="25"
            />
            <p className="text-xs text-[#64748b] mt-1">Used to calculate estimated tax liability on your financials</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Fiscal Year Start Month</label>
            <select
              value={fiscalYearStart}
              onChange={(e) => setFiscalYearStart(e.target.value)}
              className="w-full border border-[#e2e8f0] rounded-[7px] px-4 py-2 text-sm max-w-xs"
            >
              <option value="1">January</option>
              <option value="2">February</option>
              <option value="3">March</option>
              <option value="4">April</option>
              <option value="5">May</option>
              <option value="6">June</option>
              <option value="7">July</option>
              <option value="8">August</option>
              <option value="9">September</option>
              <option value="10">October</option>
              <option value="11">November</option>
              <option value="12">December</option>
            </select>
          </div>

          <div className="pt-4">
            <button
              onClick={handleSaveTaxSettings}
              className="px-6 py-2 bg-[#0f172a] text-white rounded-[7px] font-medium hover:bg-[#1e293b] transition-colors"
            >
              Save Tax Settings
            </button>
          </div>
        </div>
      </div>

      {/* Payment Methods */}
      <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-6 mb-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold">Payment Methods</h2>
          {!showAddPaymentMethod && !editingPaymentMethod && (
            <button
              onClick={() => setShowAddPaymentMethod(true)}
              className="px-4 py-2 bg-[#0f172a] text-white rounded-[7px] font-medium hover:bg-[#1e293b] transition-colors text-sm"
            >
              Add Method
            </button>
          )}
        </div>

        {/* Add/Edit Payment Method Form */}
        {(showAddPaymentMethod || editingPaymentMethod) && (
          <div className="mb-6 p-4 bg-[#f8fafc] border border-[#e2e8f0] rounded-[7px]">
            <h3 className="font-medium mb-4">
              {editingPaymentMethod ? 'Edit Payment Method' : 'Add Payment Method'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Payment Method Name</label>
                <input
                  type="text"
                  value={paymentMethodForm.name}
                  onChange={(e) => setPaymentMethodForm({ ...paymentMethodForm, name: e.target.value })}
                  className="w-full border border-[#e2e8f0] rounded-[7px] px-3 py-2 text-sm"
                  placeholder="e.g., Bank Transfer, Zelle, PayPal"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Details (Optional)</label>
                <input
                  type="text"
                  value={paymentMethodForm.details}
                  onChange={(e) => setPaymentMethodForm({ ...paymentMethodForm, details: e.target.value })}
                  className="w-full border border-[#e2e8f0] rounded-[7px] px-3 py-2 text-sm"
                  placeholder="e.g., john@example.com, acct ****1234"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={
                    editingPaymentMethod ? handleUpdatePaymentMethod : handleAddPaymentMethod
                  }
                  className="px-4 py-2 bg-[#0f172a] text-white rounded-[7px] font-medium hover:bg-[#1e293b] transition-colors text-sm"
                >
                  {editingPaymentMethod ? 'Update' : 'Add'}
                </button>
                <button
                  onClick={() => {
                    setShowAddPaymentMethod(false)
                    setEditingPaymentMethod(null)
                    setPaymentMethodForm({ name: '', details: '' })
                  }}
                  className="px-4 py-2 border border-[#e2e8f0] rounded-[7px] font-medium hover:bg-[#f8fafc] transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Payment Methods List */}
        {paymentMethods.length === 0 ? (
          <div className="text-center py-8 text-[#64748b]">
            <p className="text-sm">No payment methods configured</p>
          </div>
        ) : (
          <>
            <div className="space-y-2 mb-6">
              {paymentMethods.map((method) => (
                <div
                  key={method.name}
                  className="flex items-center justify-between p-4 border border-[#e2e8f0] rounded-[7px] bg-[#f8fafc]"
                >
                  <div>
                    <div className="font-medium text-sm">{method.name}</div>
                    {method.details && <div className="text-xs text-[#64748b] mt-1">{method.details}</div>}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingPaymentMethod(method)
                        setPaymentMethodForm(method)
                      }}
                      className="px-3 py-1 text-xs border border-[#e2e8f0] rounded-[7px] hover:bg-white transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleRemovePaymentMethod(method.name)}
                      className="px-3 py-1 text-xs border border-red-200 text-red-600 rounded-[7px] hover:bg-red-50 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {!showAddPaymentMethod && !editingPaymentMethod && (
              <button
                onClick={handleSavePaymentMethods}
                className="px-6 py-2 bg-[#0f172a] text-white rounded-[7px] font-medium hover:bg-[#1e293b] transition-colors"
              >
                Save Payment Methods
              </button>
            )}
          </>
        )}
      </div>

      {/* Claude API Key */}
      <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-6">
        <h2 className="text-lg font-bold mb-6">Claude API Key</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">ANTHROPIC_API_KEY</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full border border-[#e2e8f0] rounded-[7px] px-4 py-2 text-sm font-mono"
              placeholder="sk-ant-..."
            />
            <p className="text-xs text-[#64748b] mt-2">
              Used for AI invoice extraction. Stored locally in your browser (localStorage).
            </p>
          </div>

          <div className="pt-4">
            <button
              onClick={handleSaveApiKey}
              className="px-6 py-2 bg-[#0f172a] text-white rounded-[7px] font-medium hover:bg-[#1e293b] transition-colors"
            >
              Save API Key
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
