'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from '@/lib/theme';
import { motion, AnimatePresence } from 'framer-motion';
import SegmentedControl from '@/components/shared/SegmentedControl';

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const fadeUp = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } } };

type Tab = 'profile' | 'agency';

const AGENCY_KEY = 'calo-agency-settings';
function loadAg() { try { return JSON.parse(localStorage.getItem(AGENCY_KEY) || '{}'); } catch { return {}; } }
function saveAg(patch: Record<string, string>) { localStorage.setItem(AGENCY_KEY, JSON.stringify({ ...loadAg(), ...patch })); }

export default function SettingsPage() {
  return <Suspense fallback={<div style={{ padding: 32, opacity: 0.5, fontSize: 13 }}>Loading...</div>}><SettingsContent /></Suspense>;
}

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTheme();

  const activeTab = (searchParams.get('tab') as Tab) || 'profile';
  const setTab = (tab: Tab) => router.push(`/settings?tab=${tab}`);

  // ── Profile ──
  const [profileName, setProfileName] = useState('');
  const [profileTitle, setProfileTitle] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);

  // ── Agency ──
  const [ag, setAg] = useState<Record<string, string>>({});

  useEffect(() => {
    setProfileName(localStorage.getItem('calo-agency-profile-name') || '');
    setProfileTitle(localStorage.getItem('calo-agency-profile-title') || '');
    setProfileEmail(localStorage.getItem('calo-agency-profile-email') || '');
    setProfileAvatar(localStorage.getItem('calo-agency-avatar') || null);
    setAg(loadAg());
  }, []);

  const handleProfileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      setProfileAvatar(url);
    };
    reader.readAsDataURL(file);
  };

  const handleSetProfilePic = () => {
    if (!profileAvatar) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const size = 200;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      // Circle clip
      ctx.beginPath();
      ctx.arc(100, 100, 100, 0, Math.PI * 2);
      ctx.clip();
      // Center-crop the source image to a square
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min) / 2;
      const sy = (img.height - min) / 2;
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
      const dataUrl = canvas.toDataURL('image/png');
      localStorage.setItem('calo-agency-avatar', dataUrl);
      setProfileAvatar(dataUrl);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 1500);
    };
    img.src = profileAvatar;
  };

  const updateAg = (key: string, value: string) => {
    setAg((prev) => ({ ...prev, [key]: value }));
    saveAg({ [key]: value });
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', fontSize: 13,
    background: t.bg.primary, border: `1px solid ${t.border.default}`, borderRadius: 8,
    color: t.text.primary, fontFamily: 'inherit', outline: 'none', transition: 'border-color 150ms',
  };
  const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8 };
  const lblStyle: React.CSSProperties = { fontSize: 11, color: t.text.secondary, width: 80, flexShrink: 0 };
  const divider: React.CSSProperties = { height: 1, background: t.border.default, margin: '16px 0' };
  const secTitle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 };
  const fieldLbl: React.CSSProperties = { fontSize: 11, color: t.text.secondary, display: 'block', marginBottom: 4 };

  const focusIn = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => e.currentTarget.style.borderColor = t.border.active;
  const focusOut = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => e.currentTarget.style.borderColor = t.border.default;

  return (
    <div style={{ padding: 32, maxWidth: 960 }}>
      <motion.div variants={stagger} initial="hidden" animate="show">
        <motion.div variants={fadeUp} style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 20, fontWeight: 400, margin: '0 0 2px', color: t.text.primary }}>Settings</h1>
          <p style={{ fontSize: 13, color: t.text.tertiary, margin: 0 }}>Manage your agency configuration</p>
        </motion.div>

        <motion.div variants={fadeUp} style={{ marginBottom: 24 }}>
          <SegmentedControl
            tabs={[{ key: 'profile', label: 'Profile' }, { key: 'agency', label: 'Agency' }]}
            activeTab={activeTab}
            onChange={(key) => setTab(key as Tab)}
          />
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <div style={{ background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 12, padding: 24 }}>

              {/* ═══ PROFILE TAB ═══ */}
              {activeTab === 'profile' && (
                <div style={{ display: 'flex', gap: 24 }}>
                  <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    {profileAvatar ? (
                      <>
                        <div style={{ width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${profileSaved ? t.status.success : t.border.default}`, transition: 'border-color 300ms' }}>
                          <img src={profileAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        </div>
                        <span onClick={() => { setProfileAvatar(null); localStorage.removeItem('calo-agency-avatar'); }}
                          style={{ fontSize: 11, color: t.text.tertiary, cursor: 'pointer' }}
                          onMouseEnter={(e) => e.currentTarget.style.color = t.status.danger}
                          onMouseLeave={(e) => e.currentTarget.style.color = t.text.tertiary}>
                          Remove
                        </span>
                        <button onClick={handleSetProfilePic} style={{ fontSize: 10, padding: '3px 8px', border: `1px solid ${t.border.default}`, borderRadius: 6, background: t.bg.primary, color: profileSaved ? t.status.success : t.accent.text, cursor: 'pointer', fontFamily: 'inherit' }}>
                          {profileSaved ? '✓ Saved' : 'Set as profile pic'}
                        </button>
                      </>
                    ) : (
                      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 80, height: 80, borderRadius: '50%', border: `1px dashed ${t.border.default}`, cursor: 'pointer', color: t.text.tertiary, fontSize: 16 }}>
                        +
                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleProfileUpload} />
                      </label>
                    )}
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'center' }}>
                    <div style={rowStyle}>
                      <span style={lblStyle}>Name</span>
                      <input value={profileName} onChange={(e) => { setProfileName(e.target.value); localStorage.setItem('calo-agency-profile-name', e.target.value); }}
                        placeholder="Mike Calo" style={{ ...inputStyle, flex: 1 }} onFocus={focusIn} onBlur={focusOut} />
                    </div>
                    <div style={rowStyle}>
                      <span style={lblStyle}>Title</span>
                      <input value={profileTitle} onChange={(e) => { setProfileTitle(e.target.value); localStorage.setItem('calo-agency-profile-title', e.target.value); }}
                        placeholder="Founder, CALO&CO" style={{ ...inputStyle, flex: 1 }} onFocus={focusIn} onBlur={focusOut} />
                    </div>
                    <div style={rowStyle}>
                      <span style={lblStyle}>Email</span>
                      <input type="email" value={profileEmail} onChange={(e) => { setProfileEmail(e.target.value); localStorage.setItem('calo-agency-profile-email', e.target.value); }}
                        placeholder="mike@calo.co" style={{ ...inputStyle, flex: 1 }} onFocus={focusIn} onBlur={focusOut} />
                    </div>
                  </div>
                </div>
              )}

              {/* ═══ AGENCY TAB ═══ */}
              {activeTab === 'agency' && (
                <>
                  {/* Company */}
                  <div style={secTitle}>Company</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div><label style={fieldLbl}>Company Name</label><input value={ag.companyName || ''} onChange={(e) => updateAg('companyName', e.target.value)} placeholder="CALO&CO" style={inputStyle} onFocus={focusIn} onBlur={focusOut} /></div>
                    <div><label style={fieldLbl}>Business Address</label><input value={ag.address || ''} onChange={(e) => updateAg('address', e.target.value)} placeholder="123 Main St, Portland, ME" style={inputStyle} onFocus={focusIn} onBlur={focusOut} /></div>
                  </div>

                  <div style={divider} />

                  {/* Business Info */}
                  <div style={secTitle}>Business Info</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <div><label style={fieldLbl}>Tagline / Slogan</label><input value={ag.tagline || ''} onChange={(e) => updateAg('tagline', e.target.value)} placeholder="Your trusted partner" style={inputStyle} onFocus={focusIn} onBlur={focusOut} /></div>
                    <div><label style={fieldLbl}>Service Area</label><input value={ag.serviceArea || ''} onChange={(e) => updateAg('serviceArea', e.target.value)} placeholder="Portland Metro" style={inputStyle} onFocus={focusIn} onBlur={focusOut} /></div>
                    <div><label style={fieldLbl}>License / Cert #</label><input value={ag.licenseNumber || ''} onChange={(e) => updateAg('licenseNumber', e.target.value)} placeholder="LIC-12345" style={inputStyle} onFocus={focusIn} onBlur={focusOut} /></div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div><label style={fieldLbl}>Instagram</label><input value={ag.socialInstagram || ''} onChange={(e) => updateAg('socialInstagram', e.target.value)} placeholder="@handle" style={inputStyle} onFocus={focusIn} onBlur={focusOut} /></div>
                    <div><label style={fieldLbl}>Facebook</label><input value={ag.socialFacebook || ''} onChange={(e) => updateAg('socialFacebook', e.target.value)} placeholder="facebook.com/page" style={inputStyle} onFocus={focusIn} onBlur={focusOut} /></div>
                  </div>

                  <div style={divider} />

                  {/* Billing & Communication */}
                  <div style={secTitle}>Billing & Communication</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    <div><label style={fieldLbl}>Default Tax Rate (%)</label><input type="number" min="0" max="100" step="0.1" value={ag.taxRate || ''} onChange={(e) => updateAg('taxRate', e.target.value)} placeholder="28" style={inputStyle} onFocus={focusIn} onBlur={focusOut} /></div>
                    <div><label style={fieldLbl}>Payment Terms</label><input value={ag.paymentTerms || ''} onChange={(e) => updateAg('paymentTerms', e.target.value)} placeholder="Net 30" style={inputStyle} onFocus={focusIn} onBlur={focusOut} /></div>
                    <div><label style={fieldLbl}>Reply-to Email</label><input type="email" value={ag.replyEmail || ''} onChange={(e) => updateAg('replyEmail', e.target.value)} placeholder="mike@calo.co" style={inputStyle} onFocus={focusIn} onBlur={focusOut} /></div>
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
