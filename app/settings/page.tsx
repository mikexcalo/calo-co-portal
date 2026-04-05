'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from '@/lib/theme';
import { motion, AnimatePresence } from 'framer-motion';
import SegmentedControl from '@/components/shared/SegmentedControl';
import { PageLayout } from '@/components/shared/PageLayout';

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const fadeUp = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } } };

type Tab = 'profile' | 'agency';

const PROFILE_KEY = 'calo-settings-profile';
const AGENCY_KEY = 'calo-agency-settings';

function loadJson<T extends Record<string, string>>(key: string, defaults: T): T {
  try { return { ...defaults, ...JSON.parse(localStorage.getItem(key) || '{}') }; } catch { return defaults; }
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 32, opacity: 0.5, fontSize: 13 }}>Loading...</div>}>
      <SettingsContent />
    </Suspense>
  );
}

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTheme();
  const fileRef = useRef<HTMLInputElement>(null);

  const activeTab = (searchParams.get('tab') as Tab) || 'profile';
  const setTab = (tab: Tab) => router.push(`/settings?tab=${tab}`);

  // ── Profile state ──
  const [profile, setProfile] = useState({ name: 'Mike Calo', title: 'Founder', email: '' });
  const [avatar, setAvatar] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);

  // ── Agency state ──
  const [ag, setAg] = useState<Record<string, string>>({});

  useEffect(() => {
    setProfile(loadJson(PROFILE_KEY, { name: 'Mike Calo', title: 'Founder', email: '' }));
    setAvatar(localStorage.getItem('calo-agency-avatar') || null);
    setAg(loadJson(AGENCY_KEY, {}));
  }, []);

  // ── Profile helpers ──
  const updateProfile = (key: string, value: string) => {
    const next = { ...profile, [key]: value };
    setProfile(next);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setAvatar(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSetProfilePic = () => {
    if (!avatar) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const size = 200;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      // Clip to circle BEFORE drawing
      ctx.beginPath();
      ctx.arc(100, 100, 100, 0, Math.PI * 2);
      ctx.clip();
      // Center-crop source to square, scale to cover
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min) / 2;
      const sy = (img.height - min) / 2;
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
      const dataUrl = canvas.toDataURL('image/png');
      localStorage.setItem('calo-agency-avatar', dataUrl);
      window.dispatchEvent(new Event('storage'));
      setAvatar(dataUrl);
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2000);
    };
    img.src = avatar;
  };

  const handleRemoveAvatar = () => {
    setAvatar(null);
    localStorage.removeItem('calo-agency-avatar');
    window.dispatchEvent(new Event('storage'));
  };

  const handleDownload = (circle: boolean) => {
    if (!avatar) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const size = 200;
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      if (circle) { ctx.beginPath(); ctx.arc(100, 100, 100, 0, Math.PI * 2); ctx.clip(); }
      const min = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, size, size);
      const link = document.createElement('a');
      link.download = `headshot-${circle ? 'circle' : 'square'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = avatar;
  };

  // ── Agency helpers ──
  const updateAg = (key: string, value: string) => {
    const next = { ...ag, [key]: value };
    setAg(next);
    localStorage.setItem(AGENCY_KEY, JSON.stringify(next));
  };

  // ── Shared styles ──
  const input: React.CSSProperties = {
    width: '100%', padding: '8px 10px', fontSize: 13,
    background: t.bg.primary, border: `1px solid ${t.border.default}`, borderRadius: 8,
    color: t.text.primary, fontFamily: 'inherit', outline: 'none', transition: 'border-color 150ms',
  };
  const lbl: React.CSSProperties = { fontSize: 11, color: t.text.secondary, display: 'block', marginBottom: 4 };
  const secHead: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 };
  const divider: React.CSSProperties = { height: 1, background: t.border.default, margin: '16px 0' };

  const fi = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = t.border.active; };
  const fo = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = t.border.default; };

  return (
    <PageLayout title="Settings" subtitle="Manage your agency configuration" disableAnimation>
      <motion.div variants={stagger} initial="hidden" animate="show">

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

              {/* ═══════════ PROFILE ═══════════ */}
              {activeTab === 'profile' && (
                <div style={{ display: 'flex', gap: 28 }}>
                  {/* Headshot column */}
                  <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    {avatar ? (
                      <div style={{ width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${savedMsg ? t.status.success : t.border.default}`, transition: 'border-color 300ms' }}>
                        <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      </div>
                    ) : (
                      <div onClick={() => fileRef.current?.click()}
                        style={{ width: 80, height: 80, borderRadius: '50%', border: `1px dashed ${t.border.default}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: t.text.tertiary, fontSize: 20 }}>
                        +
                      </div>
                    )}
                    <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUpload} />

                    {avatar && (
                      <button onClick={handleSetProfilePic}
                        style={{ fontSize: 12, padding: '5px 12px', border: 'none', borderRadius: 6, background: t.accent.primary, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
                        {savedMsg ? 'Saved!' : 'Set as profile pic'}
                      </button>
                    )}

                    {avatar && (
                      <>
                        <span onClick={handleRemoveAvatar}
                          style={{ fontSize: 11, color: t.text.tertiary, cursor: 'pointer' }}
                          onMouseEnter={(e) => e.currentTarget.style.color = t.status.danger}
                          onMouseLeave={(e) => e.currentTarget.style.color = t.text.tertiary}>
                          Remove
                        </span>
                        <div style={{ fontSize: 11, color: t.accent.text, display: 'flex', gap: 4 }}>
                          <span onClick={() => handleDownload(true)} style={{ cursor: 'pointer' }}>Download circle PNG</span>
                          <span style={{ color: t.text.tertiary }}>·</span>
                          <span onClick={() => handleDownload(false)} style={{ cursor: 'pointer' }}>Download square PNG</span>
                        </div>
                      </>
                    )}

                    {!avatar && (
                      <span onClick={() => fileRef.current?.click()}
                        style={{ fontSize: 11, color: t.accent.text, cursor: 'pointer' }}>
                        Upload photo
                      </span>
                    )}
                  </div>

                  {/* Fields column */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, justifyContent: 'center' }}>
                    <div>
                      <label style={lbl}>Name</label>
                      <input value={profile.name} onChange={(e) => updateProfile('name', e.target.value)}
                        placeholder="Mike Calo" style={input} onFocus={fi} onBlur={fo} />
                    </div>
                    <div>
                      <label style={lbl}>Title</label>
                      <input value={profile.title} onChange={(e) => updateProfile('title', e.target.value)}
                        placeholder="Founder" style={input} onFocus={fi} onBlur={fo} />
                    </div>
                    <div>
                      <label style={lbl}>Email</label>
                      <input type="email" value={profile.email} onChange={(e) => updateProfile('email', e.target.value)}
                        placeholder="mike@calo.co" style={input} onFocus={fi} onBlur={fo} />
                    </div>
                  </div>
                </div>
              )}

              {/* ═══════════ AGENCY ═══════════ */}
              {activeTab === 'agency' && (
                <>
                  {/* Company */}
                  <div style={secHead}>Company</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <div><label style={lbl}>Company Name</label><input value={ag.companyName || ''} onChange={(e) => updateAg('companyName', e.target.value)} placeholder="CALO&CO" style={input} onFocus={fi} onBlur={fo} /></div>
                    <div><label style={lbl}>Address Line 1</label><input value={ag.address1 || ''} onChange={(e) => updateAg('address1', e.target.value)} placeholder="123 Main St" style={input} onFocus={fi} onBlur={fo} /></div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    <div><label style={lbl}>Address Line 2</label><input value={ag.address2 || ''} onChange={(e) => updateAg('address2', e.target.value)} placeholder="Suite 200" style={input} onFocus={fi} onBlur={fo} /></div>
                    <div><label style={lbl}>City</label><input value={ag.city || ''} onChange={(e) => updateAg('city', e.target.value)} placeholder="Portland" style={input} onFocus={fi} onBlur={fo} /></div>
                    <div><label style={lbl}>State / ZIP</label><input value={ag.stateZip || ''} onChange={(e) => updateAg('stateZip', e.target.value)} placeholder="ME 04101" style={input} onFocus={fi} onBlur={fo} /></div>
                  </div>

                  <div style={divider} />

                  {/* Business Info */}
                  <div style={secHead}>Business Info</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    <div><label style={lbl}>Tagline</label><input value={ag.tagline || ''} onChange={(e) => updateAg('tagline', e.target.value)} placeholder="Your trusted partner" style={input} onFocus={fi} onBlur={fo} /></div>
                    <div><label style={lbl}>Service Area</label><input value={ag.serviceArea || ''} onChange={(e) => updateAg('serviceArea', e.target.value)} placeholder="Portland Metro" style={input} onFocus={fi} onBlur={fo} /></div>
                    <div><label style={lbl}>License / Cert #</label><input value={ag.licenseNumber || ''} onChange={(e) => updateAg('licenseNumber', e.target.value)} placeholder="LIC-12345" style={input} onFocus={fi} onBlur={fo} /></div>
                  </div>

                  <div style={divider} />

                  {/* Billing & Communication */}
                  <div style={secHead}>Billing & Communication</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div><label style={lbl}>Tax Rate (%)</label><input type="number" min="0" max="100" step="0.1" value={ag.taxRate || ''} onChange={(e) => updateAg('taxRate', e.target.value)} placeholder="28" style={input} onFocus={fi} onBlur={fo} /></div>
                    <div><label style={lbl}>Reply-to Email</label><input type="email" value={ag.replyEmail || ''} onChange={(e) => updateAg('replyEmail', e.target.value)} placeholder="mike@calo.co" style={input} onFocus={fi} onBlur={fo} /></div>
                  </div>
                </>
              )}

            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </PageLayout>
  );
}
