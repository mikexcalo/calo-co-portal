'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DB, saveAgencySettings } from '@/lib/database';
import { Agency, PaymentMethod } from '@/lib/types';

export default function SettingsPage() {
  const router = useRouter();
  // Agency Info
  const [agencyName, setAgencyName] = useState(DB.agency.name);
  const [founderName, setFounderName] = useState(DB.agency.founder);
  const [website, setWebsite] = useState(DB.agency.url);
  const [city, setCity] = useState(DB.agency.location);

  // Brand Kit
  const [bkAgencyName, setBkAgencyName] = useState(DB.agency.name);
  const [bkFounderName, setBkFounderName] = useState(DB.agency.founder);
  const [bkWebsite, setBkWebsite] = useState(DB.agency.url);
  const [bkCity, setBkCity] = useState(DB.agency.location);
  const [bkPrimaryColor, setBkPrimaryColor] = useState('#3b82f6');
  const [bkColorHex, setBkColorHex] = useState('#3b82f6');
  const [bkLogoPreview, setBkLogoPreview] = useState<string | null>(null);

  // Financial Settings
  const [taxRate, setTaxRate] = useState(DB.agencySettings.taxRate || 28);
  const [fiscalYearStart, setFiscalYearStart] = useState(DB.agencySettings.fiscalYearStart || 1);

  // Payment Methods
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(
    DB.agencySettings.paymentMethods || []
  );

  // Claude API Key
  const [claudeKey, setClaudeKey] = useState('');
  const [claudeKeyVisible, setClaudeKeyVisible] = useState(false);
  const [claudeKeyStatus, setClaudeKeyStatus] = useState('');

  // Save Status
  const [saveStatus, setSaveStatus] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('CLAUDE_API_KEY');
    if (stored) {
      setClaudeKey(stored);
    }
  }, []);

  const handleSyncBkColor = (source: 'picker' | 'hex') => {
    if (source === 'picker') {
      setBkColorHex(bkPrimaryColor);
    } else {
      const v = bkColorHex;
      if (/^#[0-9a-fA-F]{6}$/.test(v)) {
        setBkPrimaryColor(v);
      }
    }
  };

  const handleBkLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      setBkLogoPreview(url);
    };
    reader.readAsDataURL(file);
  };

  const handleAddPaymentMethod = () => {
    setPaymentMethods([...paymentMethods, { method: '', handle: '' }]);
  };

  const handleRemovePaymentMethod = (idx: number) => {
    setPaymentMethods(paymentMethods.filter((_, i) => i !== idx));
  };

  const handlePaymentMethodChange = (
    idx: number,
    field: keyof PaymentMethod,
    value: string
  ) => {
    const updated = [...paymentMethods];
    updated[idx] = { ...updated[idx], [field]: value };
    setPaymentMethods(updated);
  };

  const handleSaveClaudeKey = () => {
    if (claudeKey.trim()) {
      localStorage.setItem('CLAUDE_API_KEY', claudeKey.trim());
      setClaudeKeyStatus('✓ Key saved');
    } else {
      localStorage.removeItem('CLAUDE_API_KEY');
      setClaudeKeyStatus('Key removed');
    }
    setTimeout(() => setClaudeKeyStatus(''), 3000);
  };

  const handleSaveSettings = async () => {
    setLoading(true);

    const agencyInfo = {
      agencyName,
      founderName,
      website,
      city,
    };

    try {
      await saveAgencySettings(taxRate, fiscalYearStart, paymentMethods, agencyInfo);
      setSaveStatus('Settings saved successfully');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveStatus('Error saving settings');
      setTimeout(() => setSaveStatus(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ];

  return (
    <div className="page">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-1">Settings</h1>
        <p className="text-sm text-slate-500">Manage your agency configuration</p>
      </div>

      {/* Agency Info Section */}
      <Section title="Agency Info">
        <div className="grid grid-cols-2 gap-6">
          <div className="form-group">
            <label className="form-label">Agency Name</label>
            <input
              type="text"
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
              placeholder="CALO&CO"
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Founder Name</label>
            <input
              type="text"
              value={founderName}
              onChange={(e) => setFounderName(e.target.value)}
              placeholder="Mike Calo"
              className="form-input"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div className="form-group">
            <label className="form-label">Website</label>
            <input
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="mikecalo.co"
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label className="form-label">City</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Portland, Maine"
              className="form-input"
            />
          </div>
        </div>
      </Section>

      {/* Agency Brand Kit Section */}
      <Section title="Agency Brand Kit" subtitle="These fields populate invoice PDF headers">
        <div className="grid grid-cols-2 gap-6">
          <div className="form-group">
            <label className="form-label">Agency Name</label>
            <input
              type="text"
              value={bkAgencyName}
              onChange={(e) => setBkAgencyName(e.target.value)}
              placeholder="CALO&CO"
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Founder Name</label>
            <input
              type="text"
              value={bkFounderName}
              onChange={(e) => setBkFounderName(e.target.value)}
              placeholder="Mike Calo"
              className="form-input"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div className="form-group">
            <label className="form-label">Website</label>
            <input
              type="text"
              value={bkWebsite}
              onChange={(e) => setBkWebsite(e.target.value)}
              placeholder="mikecalo.co"
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label className="form-label">City</label>
            <input
              type="text"
              value={bkCity}
              onChange={(e) => setBkCity(e.target.value)}
              placeholder="Portland, Maine"
              className="form-input"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div className="form-group">
            <label className="form-label">Primary Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={bkPrimaryColor}
                onChange={(e) => {
                  setBkPrimaryColor(e.target.value);
                  handleSyncBkColor('picker');
                }}
                className="w-10 h-10 border border-slate-300 rounded cursor-pointer"
              />
              <input
                type="text"
                value={bkColorHex}
                onChange={(e) => {
                  setBkColorHex(e.target.value);
                  handleSyncBkColor('hex');
                }}
                maxLength={7}
                className="form-input font-mono text-sm"
                style={{ width: '100px' }}
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Logo</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleBkLogo}
              className="text-sm"
            />
            {bkLogoPreview && (
              <div className="mt-2">
                <img
                  src={bkLogoPreview}
                  alt="Logo preview"
                  style={{ maxHeight: '48px', borderRadius: '6px' }}
                />
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* Financial Settings Section */}
      <Section title="Financial Settings">
        <div className="grid grid-cols-2 gap-6">
          <div className="form-group">
            <label className="form-label">Tax Estimate Rate (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={taxRate}
              onChange={(e) => setTaxRate(parseFloat(e.target.value) || 28)}
              placeholder="28"
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Fiscal Year Start Month</label>
            <select
              value={fiscalYearStart}
              onChange={(e) => setFiscalYearStart(parseInt(e.target.value) || 1)}
              className="form-input form-select"
            >
              {months.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Section>

      {/* Payment Methods Section */}
      <Section title="Payment Methods">
        <div className="space-y-3 mb-4">
          {paymentMethods.map((method, idx) => (
            <div key={idx} className="bg-slate-50 border border-slate-200 rounded p-4 grid grid-cols-4 gap-3 items-end">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label text-xs">Method</label>
                <input
                  type="text"
                  value={method.method}
                  onChange={(e) => handlePaymentMethodChange(idx, 'method', e.target.value)}
                  placeholder="e.g. Zelle"
                  className="form-input text-sm"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label text-xs">Handle</label>
                <input
                  type="text"
                  value={method.handle}
                  onChange={(e) => handlePaymentMethodChange(idx, 'handle', e.target.value)}
                  placeholder="username or email"
                  className="form-input text-sm"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label text-xs">Instructions</label>
                <input
                  type="text"
                  value={method.instructions || ''}
                  onChange={(e) =>
                    handlePaymentMethodChange(idx, 'instructions', e.target.value)
                  }
                  placeholder="optional"
                  className="form-input text-sm"
                />
              </div>
              <button
                onClick={() => handleRemovePaymentMethod(idx)}
                className="btn btn-danger btn-xs"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={handleAddPaymentMethod}
          className="btn btn-ghost text-sm"
        >
          + Add Payment Method
        </button>
      </Section>

      {/* Claude API Key Section */}
      <Section title="Claude API Key">
        <div className="form-group">
          <label className="form-label">API Key</label>
          <div className="flex gap-2">
            <input
              type={claudeKeyVisible ? 'text' : 'password'}
              value={claudeKey}
              onChange={(e) => setClaudeKey(e.target.value)}
              placeholder="sk-..."
              className="form-input flex-1"
            />
            <button
              onClick={() => setClaudeKeyVisible(!claudeKeyVisible)}
              className="btn btn-ghost text-sm"
            >
              {claudeKeyVisible ? '🙈' : '👁'}
            </button>
          </div>
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleSaveClaudeKey}
              className="btn btn-primary text-sm"
            >
              Save Key
            </button>
            {claudeKeyStatus && (
              <span className={`text-xs mt-1 ${claudeKeyStatus.includes('saved') ? 'text-green-600' : 'text-slate-600'}`}>
                {claudeKeyStatus}
              </span>
            )}
          </div>
        </div>
      </Section>

      {/* Save Button */}
      <div className="flex gap-2 items-center mt-8 pt-8 border-t border-slate-200">
        <button
          onClick={handleSaveSettings}
          disabled={loading}
          className="btn btn-primary"
        >
          {loading ? 'Saving...' : 'Save Settings'}
        </button>
        {saveStatus && (
          <span className={`text-sm ${saveStatus.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
            {saveStatus}
          </span>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
      <div className="mb-6">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-1">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
