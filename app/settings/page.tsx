'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from '@/lib/theme';
import { motion, AnimatePresence } from 'framer-motion';
import SegmentedControl from '@/components/shared/SegmentedControl';
import { PageLayout } from '@/components/shared/PageLayout';
import HelmSpinner from '@/components/shared/HelmSpinner';

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const fadeUp = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } } };

type Tab = 'profile' | 'agency';
const PROFILE_KEY = 'calo-settings-profile';
const AGENCY_KEY = 'calo-agency-settings';
const AVATAR_KEY = 'calo-agency-avatar';

function loadJson<T extends Record<string, string>>(key: string, defaults: T): T {
  try { return { ...defaults, ...JSON.parse(localStorage.getItem(key) || '{}') }; } catch { return defaults; }
}

export default function SettingsPage() {
  return <Suspense fallback={<div style={{ padding: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><HelmSpinner /></div>}><SettingsContent /></Suspense>;
}

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTheme();

  const activeTab = (searchParams.get('tab') as Tab) || 'profile';
  const setTab = (tab: Tab) => router.push(`/settings?tab=${tab}`);

  // Profile fields
  const [profile, setProfile] = useState({ name: 'Mike Calo', title: 'Founder', email: '' });
  const [avatar, setAvatar] = useState<string | null>(null);

  // Agency
  const [ag, setAg] = useState<Record<string, string>>({});

  // ═══ CROP TOOL STATE (from prototype) ═══
  const [rawImg, setRawImg] = useState<HTMLImageElement | null>(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOx, setCropOx] = useState(0);
  const [cropOy, setCropOy] = useState(0);
  const [showEditor, setShowEditor] = useState(false);
  const cropCanvasRef = useRef<HTMLCanvasElement>(null);
  const cropFileRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef({ dragging: false, mx0: 0, my0: 0, ox0: 0, oy0: 0 });
  const CROP_S = 560;
  const CROP_D = 280;
  const CROP_R = CROP_S / CROP_D;

  const cropSc = useCallback(() => {
    if (!rawImg) return 1;
    return (CROP_S / Math.min(rawImg.width, rawImg.height)) * cropZoom;
  }, [rawImg, cropZoom]);

  const drawCrop = useCallback(() => {
    if (!rawImg || !cropCanvasRef.current) return;
    const cx = cropCanvasRef.current.getContext('2d');
    if (!cx) return;
    cx.clearRect(0, 0, CROP_S, CROP_S);
    cx.imageSmoothingEnabled = true;
    cx.imageSmoothingQuality = 'high';
    const s = cropSc();
    cx.drawImage(rawImg, cropOx, cropOy, rawImg.width * s, rawImg.height * s);
  }, [rawImg, cropOx, cropOy, cropSc]);

  useEffect(() => { drawCrop(); }, [drawCrop]);

  const handleCropFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const im = new Image();
      im.onload = () => {
        setRawImg(im);
        setCropZoom(1);
        const sc = CROP_S / Math.min(im.width, im.height);
        setCropOx((CROP_S - im.width * sc) / 2);
        setCropOy((CROP_S - im.height * sc) / 2);
        setShowEditor(true);
      };
      im.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCropMouseDown = (e: React.MouseEvent) => {
    dragRef.current = { dragging: true, mx0: e.clientX, my0: e.clientY, ox0: cropOx, oy0: cropOy };
    e.preventDefault();
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!dragRef.current.dragging) return;
      setCropOx(dragRef.current.ox0 + (e.clientX - dragRef.current.mx0) * CROP_R);
      setCropOy(dragRef.current.oy0 + (e.clientY - dragRef.current.my0) * CROP_R);
    };
    const handleUp = () => { dragRef.current.dragging = false; };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp); };
  }, []);

  const handleZoom = (e: React.ChangeEvent<HTMLInputElement>) => {
    const oldZoom = cropZoom;
    const newZoom = parseFloat(e.target.value);
    const c = CROP_S / 2;
    setCropOx(prev => c - (c - prev) * (newZoom / oldZoom));
    setCropOy(prev => c - (c - prev) * (newZoom / oldZoom));
    setCropZoom(newZoom);
  };

  const exportCrop = (circle: boolean, sz: number) => {
    if (!rawImg) return '';
    const out = document.createElement('canvas');
    out.width = sz; out.height = sz;
    const oc = out.getContext('2d')!;
    oc.imageSmoothingEnabled = true;
    oc.imageSmoothingQuality = 'high';
    if (circle) { oc.beginPath(); oc.arc(sz/2, sz/2, sz/2, 0, Math.PI*2); oc.clip(); }
    const r = sz / CROP_S;
    const s = cropSc();
    oc.drawImage(rawImg, cropOx * r, cropOy * r, rawImg.width * s * r, rawImg.height * s * r);
    return out.toDataURL('image/png');
  };

  const saveCropAsAvatar = () => {
    const dataUrl = exportCrop(true, 400);
    localStorage.setItem(AVATAR_KEY, dataUrl);
    window.dispatchEvent(new StorageEvent('storage', { key: AVATAR_KEY, newValue: dataUrl }));
    setAvatar(dataUrl);
  };

  const downloadCrop = (circle: boolean) => {
    const url = exportCrop(circle, 800);
    const a = document.createElement('a');
    a.download = circle ? 'headshot-circle.png' : 'headshot-square.png';
    a.href = url;
    a.click();
  };

  const removeCropAvatar = () => {
    localStorage.removeItem(AVATAR_KEY);
    window.dispatchEvent(new StorageEvent('storage', { key: AVATAR_KEY, newValue: null }));
    setAvatar(null);
    setRawImg(null);
    setShowEditor(false);
  };

  // ═══ END CROP TOOL ═══

  useEffect(() => {
    setProfile(loadJson(PROFILE_KEY, { name: 'Mike Calo', title: 'Founder', email: '' }));
    const stored = localStorage.getItem(AVATAR_KEY);
    if (stored && stored.startsWith('data:image/')) setAvatar(stored);
    setAg(loadJson(AGENCY_KEY, {}));
  }, []);

  const updateProfile = (key: string, value: string) => {
    const next = { ...profile, [key]: value };
    setProfile(next);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  };

  const updateAg = (key: string, value: string) => {
    const next = { ...ag, [key]: value }; setAg(next);
    localStorage.setItem(AGENCY_KEY, JSON.stringify(next));
  };

  const input: React.CSSProperties = { width: '100%', padding: '8px 10px', fontSize: 13, background: t.bg.primary, border: `1px solid ${t.border.default}`, borderRadius: 8, color: t.text.primary, fontFamily: 'inherit', outline: 'none', transition: 'border-color 150ms' };
  const lbl: React.CSSProperties = { fontSize: 11, color: t.text.secondary, display: 'block', marginBottom: 4 };
  const secHead: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 };
  const divider: React.CSSProperties = { height: 1, background: t.border.default, margin: '16px 0' };
  const fi = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = t.border.active; };
  const fo = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = t.border.default; };

  return (
    <PageLayout title="Settings" subtitle="Manage your agency configuration" disableAnimation>
      <motion.div variants={stagger} initial="hidden" animate="show">
        <motion.div variants={fadeUp} style={{ marginBottom: 24 }}>
          <SegmentedControl tabs={[{ key: 'profile', label: 'Profile' }, { key: 'agency', label: 'Agency' }]} activeTab={activeTab} onChange={(key) => setTab(key as Tab)} />
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <div style={{ background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 12, padding: 32 }}>

              {/* ═══ PROFILE TAB ═══ */}
              {activeTab === 'profile' && (
                <div style={{ maxWidth: 560, margin: '0 auto' }}>
                  {/* Centered headshot */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
                    {!showEditor ? (
                      <>
                        <div
                          onClick={() => cropFileRef.current?.click()}
                          style={{ width: 120, height: 120, borderRadius: '50%', overflow: 'hidden',
                            border: avatar ? 'none' : `2px dashed ${t.border.default}`, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: avatar ? 'transparent' : t.bg.surfaceHover, marginBottom: 10 }}
                        >
                          {avatar ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <span style={{ fontSize: 24, color: t.text.tertiary }}>+</span>}
                        </div>
                        {avatar && (
                          <div style={{ display: 'flex', gap: 12, fontSize: 13 }}>
                            <span onClick={() => {
                              // Load existing avatar into crop tool
                              const im = new window.Image();
                              im.crossOrigin = 'anonymous';
                              im.onload = () => {
                                setRawImg(im);
                                setCropZoom(1);
                                const sc = CROP_S / Math.min(im.width, im.height);
                                setCropOx((CROP_S - im.width * sc) / 2);
                                setCropOy((CROP_S - im.height * sc) / 2);
                                setShowEditor(true);
                              };
                              im.src = avatar;
                            }} style={{ color: t.accent.text, cursor: 'pointer' }}>Edit</span>
                            <span onClick={removeCropAvatar} style={{ color: t.text.tertiary, cursor: 'pointer' }}>Remove</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div onMouseDown={handleCropMouseDown}
                          style={{ width: CROP_D, height: CROP_D, borderRadius: '50%', overflow: 'hidden',
                            border: `2px solid ${t.border.default}`, cursor: 'grab', userSelect: 'none', background: '#111' }}>
                          <canvas ref={cropCanvasRef} width={CROP_S} height={CROP_S}
                            style={{ display: 'block', width: CROP_D, height: CROP_D }} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: CROP_D }}>
                          <span style={{ fontSize: 11, color: t.text.secondary }}>Zoom</span>
                          <input type="range" min="0.5" max="4" step="0.02" value={cropZoom}
                            onChange={handleZoom} style={{ flex: 1 }} />
                          <span style={{ fontSize: 11, color: t.text.secondary, minWidth: 30 }}>{cropZoom.toFixed(1)}x</span>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={saveCropAsAvatar}
                            style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6,
                              padding: '6px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                            Save
                          </button>
                          <button onClick={() => { cropFileRef.current?.click(); }}
                            style={{ border: `1px solid ${t.border.default}`, borderRadius: 6,
                              padding: '6px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                              background: t.bg.surface, color: t.text.primary }}>
                            Change
                          </button>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <span onClick={() => downloadCrop(true)} style={{ fontSize: 11, color: t.accent.text, cursor: 'pointer' }}>Download circle</span>
                          <span style={{ fontSize: 11, color: t.text.tertiary }}>·</span>
                          <span onClick={() => downloadCrop(false)} style={{ fontSize: 11, color: t.accent.text, cursor: 'pointer' }}>Download square</span>
                        </div>
                      </>
                    )}
                    <input ref={cropFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleCropFile} />
                  </div>

                  {/* Profile fields — full width, stacked */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div><label style={{ fontSize: 12, color: t.text.tertiary, marginBottom: 6, display: 'block' }}>Name</label><input value={profile.name} onChange={(e) => updateProfile('name', e.target.value)} placeholder="Mike Calo" style={{ ...input, padding: '10px 14px', fontSize: 14 }} onFocus={fi} onBlur={fo} /></div>
                    <div><label style={{ fontSize: 12, color: t.text.tertiary, marginBottom: 6, display: 'block' }}>Title</label><input value={profile.title} onChange={(e) => updateProfile('title', e.target.value)} placeholder="Founder" style={{ ...input, padding: '10px 14px', fontSize: 14 }} onFocus={fi} onBlur={fo} /></div>
                    <div><label style={{ fontSize: 12, color: t.text.tertiary, marginBottom: 6, display: 'block' }}>Email</label><input type="email" value={profile.email} onChange={(e) => updateProfile('email', e.target.value)} placeholder="mike@calo.co" style={{ ...input, padding: '10px 14px', fontSize: 14 }} onFocus={fi} onBlur={fo} /></div>
                  </div>
                </div>
              )}

              {/* ═══ AGENCY TAB ═══ */}
              {activeTab === 'agency' && (
                <>
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
                  <div style={secHead}>Business Info</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    <div><label style={lbl}>Tagline</label><input value={ag.tagline || ''} onChange={(e) => updateAg('tagline', e.target.value)} placeholder="Your trusted partner" style={input} onFocus={fi} onBlur={fo} /></div>
                    <div><label style={lbl}>Service Area</label><input value={ag.serviceArea || ''} onChange={(e) => updateAg('serviceArea', e.target.value)} placeholder="Portland Metro" style={input} onFocus={fi} onBlur={fo} /></div>
                    <div><label style={lbl}>License / Cert #</label><input value={ag.licenseNumber || ''} onChange={(e) => updateAg('licenseNumber', e.target.value)} placeholder="LIC-12345" style={input} onFocus={fi} onBlur={fo} /></div>
                  </div>
                  <div style={divider} />
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
