'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DB, saveAgencySettings } from '@/lib/database';
import { PaymentMethod } from '@/lib/types';
import { useTheme } from '@/lib/theme';
import { motion, AnimatePresence } from 'framer-motion';
import SegmentedControl from '@/components/shared/SegmentedControl';
import BrandKit from '@/components/shared/BrandKit';

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const fadeUp = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } } };

type Tab = 'agency' | 'brand-kit' | 'financial' | 'communication';

export default function SettingsPage() {
  return <Suspense fallback={<div style={{ padding: 32, opacity: 0.5, fontSize: 13 }}>Loading...</div>}><SettingsContent /></Suspense>;
}

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTheme();

  const activeTab = (searchParams.get('tab') as Tab) || 'agency';
  const setTab = (tab: Tab) => router.push(`/settings?tab=${tab}`);

  // Agency
  const [agencyName, setAgencyName] = useState(DB.agency.name);
  const [founderName, setFounderName] = useState(DB.agency.founder);
  const [website, setWebsite] = useState(DB.agency.url);
  const [city, setCity] = useState(DB.agency.location);
  const [bkPrimaryColor, setBkPrimaryColor] = useState('#3b82f6');
  const [bkColorHex, setBkColorHex] = useState('#3b82f6');
  const [bkLogoPreview, setBkLogoPreview] = useState<string | null>(null);

  // Financial
  const [taxRate, setTaxRate] = useState(DB.agencySettings.taxRate || 28);
  const [fiscalYearStart, setFiscalYearStart] = useState(DB.agencySettings.fiscalYearStart || 1);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(DB.agencySettings.paymentMethods || []);

  // Communication
  const [defaultEmailClient, setDefaultEmailClient] = useState((DB.agencySettings as any).defaultEmailClient || 'gmail');
  const [sendFromEmail, setSendFromEmail] = useState((DB.agencySettings as any).sendFromEmail || DB.agency.url || '');
  const [preferredContactMethod, setPreferredContactMethod] = useState((DB.agencySettings as any).preferredContactMethod || 'email');

  // Save
  const [saveStatus, setSaveStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    (DB.agencySettings as any).defaultEmailClient = defaultEmailClient;
    (DB.agencySettings as any).sendFromEmail = sendFromEmail;
    (DB.agencySettings as any).preferredContactMethod = preferredContactMethod;
    try {
      await saveAgencySettings(taxRate, fiscalYearStart, paymentMethods, { agencyName, founderName, website, city });
      setSaveStatus('Saved'); setTimeout(() => setSaveStatus(''), 3000);
    } catch { setSaveStatus('Error'); setTimeout(() => setSaveStatus(''), 3000); }
    finally { setLoading(false); }
  };

  const handleBkLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setBkLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', fontSize: 14,
    background: t.bg.primary, border: `1px solid ${t.border.default}`, borderRadius: 8,
    color: t.text.primary, fontFamily: 'inherit', outline: 'none', transition: 'border-color 150ms',
  };
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: t.text.secondary, display: 'block', marginBottom: 6 };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'agency', label: 'Agency' },
    { id: 'brand-kit', label: 'Brand Kit' },
    { id: 'financial', label: 'Financial' },
    { id: 'communication', label: 'Communication' },
  ];

  const months = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: new Date(2000, i).toLocaleString('en', { month: 'long' }) }));

  return (
    <div style={{ padding: 32, maxWidth: 960 }}>
      <motion.div variants={stagger} initial="hidden" animate="show">

        <motion.div variants={fadeUp} style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 20, fontWeight: 400, margin: '0 0 2px', color: t.text.primary }}>Settings</h1>
          <p style={{ fontSize: 13, color: t.text.tertiary, margin: 0 }}>Manage your agency configuration</p>
        </motion.div>

        {/* Segmented control */}
        <motion.div variants={fadeUp} style={{ marginBottom: 24 }}>
          <SegmentedControl
            tabs={tabs.map((tb) => ({ key: tb.id, label: tb.label }))}
            activeTab={activeTab}
            onChange={(key) => setTab(key as Tab)}
          />
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <div style={{ background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 12, padding: 24 }}>

              {activeTab === 'agency' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                    <div><label style={labelStyle}>Agency Name</label><input value={agencyName} onChange={(e) => setAgencyName(e.target.value)} placeholder="CALO&CO" style={inputStyle} onFocus={(e) => e.currentTarget.style.borderColor = t.border.active} onBlur={(e) => e.currentTarget.style.borderColor = t.border.default} /></div>
                    <div><label style={labelStyle}>Founder Name</label><input value={founderName} onChange={(e) => setFounderName(e.target.value)} placeholder="Mike Calo" style={inputStyle} onFocus={(e) => e.currentTarget.style.borderColor = t.border.active} onBlur={(e) => e.currentTarget.style.borderColor = t.border.default} /></div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                    <div><label style={labelStyle}>Website</label><input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="mikecalo.co" style={inputStyle} onFocus={(e) => e.currentTarget.style.borderColor = t.border.active} onBlur={(e) => e.currentTarget.style.borderColor = t.border.default} /></div>
                    <div><label style={labelStyle}>City</label><input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Portland, Maine" style={inputStyle} onFocus={(e) => e.currentTarget.style.borderColor = t.border.active} onBlur={(e) => e.currentTarget.style.borderColor = t.border.default} /></div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <label style={labelStyle}>Primary Color</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input type="color" value={bkPrimaryColor} onChange={(e) => { setBkPrimaryColor(e.target.value); setBkColorHex(e.target.value); }}
                          style={{ width: 40, height: 40, border: `1px solid ${t.border.default}`, borderRadius: 8, cursor: 'pointer', padding: 0 }} />
                        <input value={bkColorHex} onChange={(e) => { setBkColorHex(e.target.value); if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) setBkPrimaryColor(e.target.value); }}
                          maxLength={7} style={{ ...inputStyle, width: 100, fontFamily: 'monospace' }} />
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: bkPrimaryColor, flexShrink: 0 }} />
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>Logo</label>
                      <input type="file" accept="image/*" onChange={handleBkLogo} style={{ fontSize: 13, color: t.text.secondary }} />
                      {bkLogoPreview && <img src={bkLogoPreview} alt="Preview" style={{ maxHeight: 40, borderRadius: 6, marginTop: 8 }} />}
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'brand-kit' && (
                <BrandKit context={{ type: 'agency' }} />
              )}

              {activeTab === 'financial' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                    <div><label style={labelStyle}>Tax Estimate Rate (%)</label><input type="number" min="0" max="100" step="0.1" value={taxRate} onChange={(e) => setTaxRate(parseFloat(e.target.value) || 28)} style={inputStyle} /></div>
                    <div><label style={labelStyle}>Fiscal Year Start Month</label>
                      <select value={fiscalYearStart} onChange={(e) => setFiscalYearStart(parseInt(e.target.value) || 1)} style={inputStyle}>
                        {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: t.text.primary, marginBottom: 12 }}>Payment methods</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                    {paymentMethods.map((pm, idx) => (
                      <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
                        <div><label style={{ ...labelStyle, fontSize: 11 }}>Method</label><input value={pm.method} onChange={(e) => { const u = [...paymentMethods]; u[idx] = { ...u[idx], method: e.target.value }; setPaymentMethods(u); }} placeholder="e.g. Zelle" style={{ ...inputStyle, fontSize: 13 }} /></div>
                        <div><label style={{ ...labelStyle, fontSize: 11 }}>Handle</label><input value={pm.handle} onChange={(e) => { const u = [...paymentMethods]; u[idx] = { ...u[idx], handle: e.target.value }; setPaymentMethods(u); }} placeholder="username" style={{ ...inputStyle, fontSize: 13 }} /></div>
                        <div><label style={{ ...labelStyle, fontSize: 11 }}>Instructions</label><input value={pm.instructions || ''} onChange={(e) => { const u = [...paymentMethods]; u[idx] = { ...u[idx], instructions: e.target.value }; setPaymentMethods(u); }} placeholder="optional" style={{ ...inputStyle, fontSize: 13 }} /></div>
                        <button onClick={() => setPaymentMethods(paymentMethods.filter((_, i) => i !== idx))} style={{
                          background: 'none', border: 'none', fontSize: 12, color: t.text.tertiary, cursor: 'pointer',
                          fontFamily: 'inherit', padding: '10px 0', transition: 'color 150ms',
                        }} onMouseEnter={(e) => e.currentTarget.style.color = t.status.danger} onMouseLeave={(e) => e.currentTarget.style.color = t.text.tertiary}>Remove</button>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setPaymentMethods([...paymentMethods, { method: '', handle: '' }])} style={{
                    background: 'none', border: 'none', fontSize: 13, fontWeight: 500, color: t.accent.text, cursor: 'pointer', fontFamily: 'inherit', padding: 0,
                  }}>+ Add Payment Method</button>
                </>
              )}

              {activeTab === 'communication' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                  <div><label style={labelStyle}>Default Email Client</label>
                    <select value={defaultEmailClient} onChange={(e) => setDefaultEmailClient(e.target.value)} style={inputStyle}>
                      <option value="gmail">Gmail</option><option value="outlook">Outlook</option><option value="yahoo">Yahoo Mail</option><option value="apple">Apple Mail</option><option value="other">Other</option>
                    </select>
                  </div>
                  <div><label style={labelStyle}>Default Send-From Email</label><input type="email" value={sendFromEmail} onChange={(e) => setSendFromEmail(e.target.value)} placeholder="mike@mikecalo.co" style={inputStyle} /></div>
                  <div><label style={labelStyle}>Preferred Contact Method</label>
                    <select value={preferredContactMethod} onChange={(e) => setPreferredContactMethod(e.target.value)} style={inputStyle}>
                      <option value="email">Email</option><option value="text">Text</option><option value="phone">Phone</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Save button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginTop: 24, paddingTop: 16, borderTop: `1px solid ${t.border.default}` }}>
                {saveStatus && <span style={{ fontSize: 12, color: saveStatus === 'Saved' ? t.status.success : t.status.danger }}>{saveStatus}</span>}
                <button onClick={handleSave} disabled={loading} style={{
                  background: t.accent.primary, color: '#fff', border: 'none', borderRadius: 8,
                  padding: '10px 20px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'background 150ms',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = t.accent.primaryHover}
                onMouseLeave={(e) => e.currentTarget.style.background = t.accent.primary}
                >{loading ? 'Saving...' : 'Save'}</button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
