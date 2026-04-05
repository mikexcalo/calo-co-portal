'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from '@/lib/theme';
import { motion, AnimatePresence } from 'framer-motion';
import SegmentedControl from '@/components/shared/SegmentedControl';

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const fadeUp = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } } };

type Tab = 'profile' | 'agency';

const AGENCY_SETTINGS_KEY = 'calo-agency-settings';

function loadAgencySettings() {
  try { return JSON.parse(localStorage.getItem(AGENCY_SETTINGS_KEY) || '{}'); } catch { return {}; }
}

function saveAgencySettingsLS(patch: Record<string, string>) {
  const cur = loadAgencySettings();
  localStorage.setItem(AGENCY_SETTINGS_KEY, JSON.stringify({ ...cur, ...patch }));
}

export default function SettingsPage() {
  return <Suspense fallback={<div style={{ padding: 32, opacity: 0.5, fontSize: 13 }}>Loading...</div>}><SettingsContent /></Suspense>;
}

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTheme();

  const activeTab = (searchParams.get('tab') as Tab) || 'profile';
  const setTab = (tab: Tab) => router.push(`/settings?tab=${tab}`);

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', fontSize: 13,
    background: t.bg.primary, border: `1px solid ${t.border.default}`, borderRadius: 8,
    color: t.text.primary, fontFamily: 'inherit', outline: 'none', transition: 'border-color 150ms',
  };

  // ── Profile state ──
  const [profileName, setProfileName] = useState('');
  const [profileTitle, setProfileTitle] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);

  // ── Agency state ──
  const [agencyCompany, setAgencyCompany] = useState('');
  const [agencyAddress, setAgencyAddress] = useState('');
  const [agencyTaxRate, setAgencyTaxRate] = useState('');
  const [agencyPayTerms, setAgencyPayTerms] = useState('');
  const [agencyPayMethod, setAgencyPayMethod] = useState('');
  const [agencyDisplayName, setAgencyDisplayName] = useState('');
  const [agencyReplyEmail, setAgencyReplyEmail] = useState('');
  const [agencyFooterText, setAgencyFooterText] = useState('');

  useEffect(() => {
    // Load profile
    setProfileName(localStorage.getItem('calo-agency-profile-name') || '');
    setProfileTitle(localStorage.getItem('calo-agency-profile-title') || '');
    setProfileEmail(localStorage.getItem('calo-agency-profile-email') || '');
    setProfileAvatar(localStorage.getItem('calo-agency-avatar') || null);
    // Load agency
    const ag = loadAgencySettings();
    setAgencyCompany(ag.companyName || '');
    setAgencyAddress(ag.address || '');
    setAgencyTaxRate(ag.taxRate || '');
    setAgencyPayTerms(ag.paymentTerms || '');
    setAgencyPayMethod(ag.paymentMethod || '');
    setAgencyDisplayName(ag.displayName || '');
    setAgencyReplyEmail(ag.replyEmail || '');
    setAgencyFooterText(ag.footerText || '');
  }, []);

  const handleProfileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      setProfileAvatar(url);
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
      const sx = (img.width - min) / 2; const sy = (img.height - min) / 2;
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
      const cropped = canvas.toDataURL('image/png');
      localStorage.setItem('calo-agency-avatar', cropped);
      setProfileAvatar(cropped);
      setProfileSaved(true); setTimeout(() => setProfileSaved(false), 1500);
    };
    img.src = profileAvatar;
  };

  // Agency field updater
  const updateAgency = (key: string, value: string, setter: (v: string) => void) => {
    setter(value);
    saveAgencySettingsLS({ [key]: value });
  };

  const tabs = [
    { key: 'profile', label: 'Profile' },
    { key: 'agency', label: 'Agency' },
  ];

  const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8 };
  const lblStyle: React.CSSProperties = { fontSize: 11, color: t.text.secondary, width: 100, flexShrink: 0 };
  const divider: React.CSSProperties = { height: 1, background: t.border.default, margin: '16px 0' };
  const sectionTitle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 };

  return (
    <div style={{ padding: 32, maxWidth: 960 }}>
      <motion.div variants={stagger} initial="hidden" animate="show">

        <motion.div variants={fadeUp} style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 20, fontWeight: 400, margin: '0 0 2px', color: t.text.primary }}>Settings</h1>
          <p style={{ fontSize: 13, color: t.text.tertiary, margin: 0 }}>Manage your agency configuration</p>
        </motion.div>

        <motion.div variants={fadeUp} style={{ marginBottom: 24 }}>
          <SegmentedControl
            tabs={tabs}
            activeTab={activeTab}
            onChange={(key) => setTab(key as Tab)}
          />
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <div style={{ background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 12, padding: 24 }}>

              {activeTab === 'profile' && (
                <div style={{ display: 'flex', gap: 24 }}>
                  {/* Left: headshot 80×80 */}
                  <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    {profileAvatar ? (
                      <>
                        <div style={{ position: 'relative', width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${profileSaved ? t.status.success : t.border.default}`, transition: 'border-color 300ms' }}>
                          <img src={profileAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <button onClick={() => { setProfileAvatar(null); localStorage.removeItem('calo-agency-avatar'); }}
                            style={{ position: 'absolute', top: 2, right: 2, width: 16, height: 16, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', fontSize: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                        </div>
                        <button onClick={handleSetProfilePic} style={{ fontSize: 10, padding: '3px 8px', border: `1px solid ${t.border.default}`, borderRadius: t.radius.sm, background: t.bg.primary, color: profileSaved ? t.status.success : t.accent.text, cursor: 'pointer', fontFamily: 'inherit' }}>
                          {profileSaved ? (
                            <><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ marginRight: 2, verticalAlign: '-1px' }}><polyline points="20 6 9 17 4 12"/></svg>Saved</>
                          ) : (
                            <><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 2, verticalAlign: '-1px' }}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>Set as profile pic</>
                          )}
                        </button>
                      </>
                    ) : (
                      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 80, height: 80, borderRadius: '50%', border: `1px dashed ${t.border.default}`, cursor: 'pointer', color: t.text.tertiary, fontSize: 16 }}>
                        +
                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleProfileUpload} />
                      </label>
                    )}
                  </div>
                  {/* Right: text fields */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'center' }}>
                    <div style={rowStyle}>
                      <span style={lblStyle}>Name</span>
                      <input type="text" value={profileName} onChange={(e) => { setProfileName(e.target.value); localStorage.setItem('calo-agency-profile-name', e.target.value); }}
                        placeholder="Mike Calo" style={{ ...inputStyle, flex: 1 }}
                        onFocus={(e) => e.currentTarget.style.borderColor = t.border.active} onBlur={(e) => e.currentTarget.style.borderColor = t.border.default} />
                    </div>
                    <div style={rowStyle}>
                      <span style={lblStyle}>Title</span>
                      <input type="text" value={profileTitle} onChange={(e) => { setProfileTitle(e.target.value); localStorage.setItem('calo-agency-profile-title', e.target.value); }}
                        placeholder="Founder, CALO&CO" style={{ ...inputStyle, flex: 1 }}
                        onFocus={(e) => e.currentTarget.style.borderColor = t.border.active} onBlur={(e) => e.currentTarget.style.borderColor = t.border.default} />
                    </div>
                    <div style={rowStyle}>
                      <span style={lblStyle}>Email</span>
                      <input type="email" value={profileEmail} onChange={(e) => { setProfileEmail(e.target.value); localStorage.setItem('calo-agency-profile-email', e.target.value); }}
                        placeholder="mike@calo.co" style={{ ...inputStyle, flex: 1 }}
                        onFocus={(e) => e.currentTarget.style.borderColor = t.border.active} onBlur={(e) => e.currentTarget.style.borderColor = t.border.default} />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'agency' && (
                <>
                  {/* Company */}
                  <div style={sectionTitle}>Company</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={rowStyle}>
                      <span style={lblStyle}>Name</span>
                      <input value={agencyCompany} onChange={(e) => updateAgency('companyName', e.target.value, setAgencyCompany)}
                        placeholder="CALO&CO" style={{ ...inputStyle, flex: 1 }}
                        onFocus={(e) => e.currentTarget.style.borderColor = t.border.active} onBlur={(e) => e.currentTarget.style.borderColor = t.border.default} />
                    </div>
                    <div style={rowStyle}>
                      <span style={lblStyle}>Address</span>
                      <input value={agencyAddress} onChange={(e) => updateAgency('address', e.target.value, setAgencyAddress)}
                        placeholder="123 Main St, Portland, ME" style={{ ...inputStyle, flex: 1 }}
                        onFocus={(e) => e.currentTarget.style.borderColor = t.border.active} onBlur={(e) => e.currentTarget.style.borderColor = t.border.default} />
                    </div>
                  </div>

                  <div style={divider} />

                  {/* Billing */}
                  <div style={sectionTitle}>Billing</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={rowStyle}>
                      <span style={lblStyle}>Tax Rate %</span>
                      <input type="number" min="0" max="100" step="0.1" value={agencyTaxRate} onChange={(e) => updateAgency('taxRate', e.target.value, setAgencyTaxRate)}
                        placeholder="28" style={{ ...inputStyle, flex: 1 }}
                        onFocus={(e) => e.currentTarget.style.borderColor = t.border.active} onBlur={(e) => e.currentTarget.style.borderColor = t.border.default} />
                    </div>
                    <div style={rowStyle}>
                      <span style={lblStyle}>Pay Terms</span>
                      <select value={agencyPayTerms} onChange={(e) => updateAgency('paymentTerms', e.target.value, setAgencyPayTerms)}
                        style={{ ...inputStyle, flex: 1 }}>
                        <option value="">Select...</option>
                        <option value="Due on receipt">Due on receipt</option>
                        <option value="Net 15">Net 15</option>
                        <option value="Net 30">Net 30</option>
                        <option value="Net 60">Net 60</option>
                      </select>
                    </div>
                    <div style={rowStyle}>
                      <span style={lblStyle}>Pay Method</span>
                      <input value={agencyPayMethod} onChange={(e) => updateAgency('paymentMethod', e.target.value, setAgencyPayMethod)}
                        placeholder="Zelle, Venmo, Check" style={{ ...inputStyle, flex: 1 }}
                        onFocus={(e) => e.currentTarget.style.borderColor = t.border.active} onBlur={(e) => e.currentTarget.style.borderColor = t.border.default} />
                    </div>
                  </div>

                  <div style={divider} />

                  {/* Account */}
                  <div style={sectionTitle}>Account</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={rowStyle}>
                      <span style={lblStyle}>Display Name</span>
                      <input value={agencyDisplayName} onChange={(e) => updateAgency('displayName', e.target.value, setAgencyDisplayName)}
                        placeholder="Mike Calo" style={{ ...inputStyle, flex: 1 }}
                        onFocus={(e) => e.currentTarget.style.borderColor = t.border.active} onBlur={(e) => e.currentTarget.style.borderColor = t.border.default} />
                    </div>
                    <div style={rowStyle}>
                      <span style={lblStyle}>Reply Email</span>
                      <input type="email" value={agencyReplyEmail} onChange={(e) => updateAgency('replyEmail', e.target.value, setAgencyReplyEmail)}
                        placeholder="mike@calo.co" style={{ ...inputStyle, flex: 1 }}
                        onFocus={(e) => e.currentTarget.style.borderColor = t.border.active} onBlur={(e) => e.currentTarget.style.borderColor = t.border.default} />
                    </div>
                    <div style={rowStyle}>
                      <span style={lblStyle}>Footer Text</span>
                      <input value={agencyFooterText} onChange={(e) => updateAgency('footerText', e.target.value, setAgencyFooterText)}
                        placeholder="Sent with care from CALO&CO" style={{ ...inputStyle, flex: 1 }}
                        onFocus={(e) => e.currentTarget.style.borderColor = t.border.active} onBlur={(e) => e.currentTarget.style.borderColor = t.border.default} />
                    </div>
                  </div>
                </>
              )}

            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
