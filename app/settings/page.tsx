'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DB, saveAgencySettings } from '@/lib/database';
import { PaymentMethod } from '@/lib/types';
import { useTheme } from '@/lib/theme';
import { motion, AnimatePresence } from 'framer-motion';
import SegmentedControl from '@/components/shared/SegmentedControl';
import BrandKit from '@/components/shared/BrandKit';

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const fadeUp = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } } };

type Tab = 'profile' | 'agency' | 'brand-kit' | 'financial' | 'communication';

export default function SettingsPage() {
  return <Suspense fallback={<div style={{ padding: 32, opacity: 0.5, fontSize: 13 }}>Loading...</div>}><SettingsContent /></Suspense>;
}

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTheme();

  const activeTab = (searchParams.get('tab') as Tab) || 'profile';
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

  // Profile state
  const [profileName, setProfileName] = useState('');
  const [profileTitle, setProfileTitle] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [profileZoom, setProfileZoom] = useState(1);
  const [profileOffset, setProfileOffset] = useState({ x: 0, y: 0 });
  const [profileDragging, setProfileDragging] = useState(false);
  const profileDragStart = React.useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const [profileSaved, setProfileSaved] = useState(false);

  useEffect(() => {
    setProfileName(localStorage.getItem('calo-agency-profile-name') || '');
    setProfileTitle(localStorage.getItem('calo-agency-profile-title') || '');
    setProfileEmail(localStorage.getItem('calo-agency-profile-email') || '');
    setProfileAvatar(localStorage.getItem('calo-agency-avatar') || null);
  }, []);

  useEffect(() => {
    if (!profileDragging) return;
    const onMove = (e: MouseEvent | TouchEvent) => {
      const pt = 'touches' in e ? e.touches[0] : e;
      const maxOff = 40 * profileZoom;
      const nx = Math.max(-maxOff, Math.min(maxOff, profileDragStart.current.ox + pt.clientX - profileDragStart.current.x));
      const ny = Math.max(-maxOff, Math.min(maxOff, profileDragStart.current.oy + pt.clientY - profileDragStart.current.y));
      setProfileOffset({ x: nx, y: ny });
    };
    const onUp = () => setProfileDragging(false);
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove); window.addEventListener('touchend', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); window.removeEventListener('touchmove', onMove); window.removeEventListener('touchend', onUp); };
  }, [profileDragging, profileZoom]);

  const handleProfileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      setProfileAvatar(url);
      setProfileZoom(1);
      setProfileOffset({ x: 0, y: 0 });
      localStorage.setItem('calo-agency-avatar', url);
    };
    reader.readAsDataURL(file);
  };

  const handleSetProfilePic = () => {
    if (!profileAvatar) return;
    const img = new Image();
    img.onload = () => {
      const size = 200;
      const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      ctx.beginPath(); ctx.arc(100, 100, 100, 0, Math.PI * 2); ctx.clip();
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min) / 2 - (profileOffset.x / 120) * min / profileZoom;
      const sy = (img.height - min) / 2 - (profileOffset.y / 120) * min / profileZoom;
      ctx.drawImage(img, sx, sy, min / profileZoom, min / profileZoom, 0, 0, size, size);
      const cropped = canvas.toDataURL('image/png');
      localStorage.setItem('calo-agency-avatar', cropped);
      setProfileAvatar(cropped);
      setProfileSaved(true); setTimeout(() => setProfileSaved(false), 1500);
    };
    img.src = profileAvatar;
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'profile', label: 'Profile' },
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

              {activeTab === 'profile' && (
                <div style={{ display: 'grid', gridTemplateColumns: '40% 60%', gap: 24 }}>
                  {/* Left: headshot */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    {profileAvatar ? (
                      <>
                        <div style={{ position: 'relative', width: 120, height: 120, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${profileSaved ? t.status.success : t.border.default}`, cursor: profileDragging ? 'grabbing' : 'grab', transition: 'border-color 300ms' }}
                          onMouseDown={(e) => { e.preventDefault(); profileDragStart.current = { x: e.clientX, y: e.clientY, ox: profileOffset.x, oy: profileOffset.y }; setProfileDragging(true); }}
                          onTouchStart={(e) => { const pt = e.touches[0]; profileDragStart.current = { x: pt.clientX, y: pt.clientY, ox: profileOffset.x, oy: profileOffset.y }; setProfileDragging(true); }}>
                          <img src={profileAvatar} alt="" draggable={false} style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', transform: `translate(${profileOffset.x}px, ${profileOffset.y}px) scale(${profileZoom})`, pointerEvents: 'none' }} />
                          <button onClick={(e) => { e.stopPropagation(); setProfileAvatar(null); localStorage.removeItem('calo-agency-avatar'); }}
                            style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>×</button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: 120 }}>
                          <span style={{ fontSize: 12 }}>🔍</span>
                          <input type="range" min="1" max="3" step="0.05" value={profileZoom}
                            onChange={(e) => setProfileZoom(parseFloat(e.target.value))}
                            style={{ flex: 1, height: 4, cursor: 'pointer' }} />
                        </div>
                        <button onClick={handleSetProfilePic} style={{ fontSize: 11, padding: '4px 10px', border: `1px solid ${t.border.default}`, borderRadius: t.radius.sm, background: t.bg.primary, color: profileSaved ? t.status.success : t.accent.text, cursor: 'pointer', fontFamily: 'inherit' }}>
                          {profileSaved ? (
                            <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ marginRight: 3, verticalAlign: '-1px' }}><polyline points="20 6 9 17 4 12"/></svg>Saved</>
                          ) : (
                            <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 3, verticalAlign: '-1px' }}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>Set as profile pic</>
                          )}
                        </button>
                      </>
                    ) : (
                      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 120, height: 120, borderRadius: '50%', border: `1px dashed ${t.border.default}`, cursor: 'pointer', color: t.text.tertiary, fontSize: 18 }}>
                        +
                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleProfileUpload} />
                      </label>
                    )}
                  </div>
                  {/* Right: text fields */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: t.text.secondary, width: 44, flexShrink: 0 }}>Name</span>
                      <input type="text" value={profileName} onChange={(e) => { setProfileName(e.target.value); localStorage.setItem('calo-agency-profile-name', e.target.value); }}
                        placeholder="Mike Calo" style={{ ...inputStyle, flex: 1, padding: '8px 10px', fontSize: 13 }}
                        onFocus={(e) => e.currentTarget.style.borderColor = t.border.active} onBlur={(e) => e.currentTarget.style.borderColor = t.border.default} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: t.text.secondary, width: 44, flexShrink: 0 }}>Title</span>
                      <input type="text" value={profileTitle} onChange={(e) => { setProfileTitle(e.target.value); localStorage.setItem('calo-agency-profile-title', e.target.value); }}
                        placeholder="Founder, CALO&CO" style={{ ...inputStyle, flex: 1, padding: '8px 10px', fontSize: 13 }}
                        onFocus={(e) => e.currentTarget.style.borderColor = t.border.active} onBlur={(e) => e.currentTarget.style.borderColor = t.border.default} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: t.text.secondary, width: 44, flexShrink: 0 }}>Email</span>
                      <input type="email" value={profileEmail} onChange={(e) => { setProfileEmail(e.target.value); localStorage.setItem('calo-agency-profile-email', e.target.value); }}
                        placeholder="mike@calo.co" style={{ ...inputStyle, flex: 1, padding: '8px 10px', fontSize: 13 }}
                        onFocus={(e) => e.currentTarget.style.borderColor = t.border.active} onBlur={(e) => e.currentTarget.style.borderColor = t.border.default} />
                    </div>
                  </div>
                </div>
              )}

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
