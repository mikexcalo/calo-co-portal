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
const AVATAR_KEY = 'calo-agency-avatar';

function loadJson<T extends Record<string, string>>(key: string, defaults: T): T {
  try { return { ...defaults, ...JSON.parse(localStorage.getItem(key) || '{}') }; } catch { return defaults; }
}

export default function SettingsPage() {
  return <Suspense fallback={<div style={{ padding: 32, opacity: 0.5, fontSize: 13 }}>Loading...</div>}><SettingsContent /></Suspense>;
}

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTheme();
  const fileRef = useRef<HTMLInputElement>(null);

  const activeTab = (searchParams.get('tab') as Tab) || 'profile';
  const setTab = (tab: Tab) => router.push(`/settings?tab=${tab}`);

  // Profile
  const [profile, setProfile] = useState({ name: 'Mike Calo', title: 'Founder', email: '' });
  const [avatar, setAvatar] = useState<string | null>(null);
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);

  // Agency
  const [ag, setAg] = useState<Record<string, string>>({});

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

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setRawImage(ev.target?.result as string); setCropOpen(true); };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCropSave = (dataUrl: string) => {
    localStorage.setItem(AVATAR_KEY, dataUrl);
    window.dispatchEvent(new StorageEvent('storage', { key: AVATAR_KEY, newValue: dataUrl }));
    setAvatar(dataUrl);
    setCropOpen(false);
  };

  const handleEdit = () => { setRawImage(rawImage || avatar); setCropOpen(true); };

  const handleRemove = () => {
    setAvatar(null); setRawImage(null);
    localStorage.removeItem(AVATAR_KEY);
    window.dispatchEvent(new StorageEvent('storage', { key: AVATAR_KEY, newValue: null }));
  };

  const handleDownload = (circle: boolean) => {
    if (!avatar) return;
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => {
      const s = 200; const c = document.createElement('canvas'); c.width = s; c.height = s;
      const ctx = c.getContext('2d')!;
      if (circle) { ctx.beginPath(); ctx.arc(100, 100, 100, 0, Math.PI * 2); ctx.clip(); }
      const min = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, s, s);
      const a = document.createElement('a'); a.download = `headshot-${circle ? 'circle' : 'square'}.png`; a.href = c.toDataURL('image/png'); a.click();
    };
    img.src = avatar;
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
            <div style={{ background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 12, padding: 24 }}>

              {activeTab === 'profile' && (
                <div style={{ display: 'flex', gap: 28 }}>
                  <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    {avatar ? (
                      <div style={{ width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${t.border.default}` }}>
                        <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      </div>
                    ) : (
                      <div onClick={() => fileRef.current?.click()} style={{ width: 80, height: 80, borderRadius: '50%', border: `1px dashed ${t.border.default}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: t.text.tertiary, fontSize: 20 }}>+</div>
                    )}
                    <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUpload} />
                    {avatar ? (
                      <>
                        <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
                          <span onClick={handleEdit} style={{ color: t.accent.text, cursor: 'pointer' }}>Edit</span>
                          <span onClick={handleRemove} style={{ color: t.text.tertiary, cursor: 'pointer' }} onMouseEnter={(e) => e.currentTarget.style.color = t.status.danger} onMouseLeave={(e) => e.currentTarget.style.color = t.text.tertiary}>Remove</span>
                        </div>
                        <div style={{ fontSize: 11, color: t.accent.text, display: 'flex', gap: 4 }}>
                          <span onClick={() => handleDownload(true)} style={{ cursor: 'pointer' }}>Download circle</span>
                          <span style={{ color: t.text.tertiary }}>·</span>
                          <span onClick={() => handleDownload(false)} style={{ cursor: 'pointer' }}>Download square</span>
                        </div>
                      </>
                    ) : (
                      <span onClick={() => fileRef.current?.click()} style={{ fontSize: 11, color: t.accent.text, cursor: 'pointer' }}>Upload photo</span>
                    )}
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, justifyContent: 'center' }}>
                    <div><label style={lbl}>Name</label><input value={profile.name} onChange={(e) => updateProfile('name', e.target.value)} placeholder="Mike Calo" style={input} onFocus={fi} onBlur={fo} /></div>
                    <div><label style={lbl}>Title</label><input value={profile.title} onChange={(e) => updateProfile('title', e.target.value)} placeholder="Founder" style={input} onFocus={fi} onBlur={fo} /></div>
                    <div><label style={lbl}>Email</label><input type="email" value={profile.email} onChange={(e) => updateProfile('email', e.target.value)} placeholder="mike@calo.co" style={input} onFocus={fi} onBlur={fo} /></div>
                  </div>
                </div>
              )}

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

      {/* ═══ CROP MODAL (inline) ═══ */}
      {cropOpen && rawImage && <CropModal src={rawImage} t={t} onSave={handleCropSave} onCancel={() => setCropOpen(false)} />}
    </PageLayout>
  );
}

// ═══════════════════════════════════════════
// Canvas-based crop modal
// ═══════════════════════════════════════════
function CropModal({ src, t, onSave, onCancel }: { src: string; t: any; onSave: (dataUrl: string) => void; onCancel: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const stateRef = useRef({ zoom: 1, ox: 0, oy: 0, dragging: false, startX: 0, startY: 0, startOx: 0, startOy: 0 });
  const [zoom, setZoom] = useState(1);

  const draw = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d')!;
    const s = stateRef.current;
    const size = 300;
    ctx.clearRect(0, 0, size, size);

    // Scale so shorter side fills 300px, then apply zoom
    const scale = (Math.max(size / img.width, size / img.height)) * s.zoom;
    const dw = img.width * scale;
    const dh = img.height * scale;
    const dx = (size - dw) / 2 + s.ox;
    const dy = (size - dh) / 2 + s.oy;

    // Draw image
    ctx.save();
    ctx.beginPath(); ctx.arc(150, 150, 150, 0, Math.PI * 2); ctx.clip();
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();

    // Dim outside circle
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath(); ctx.arc(150, 150, 150, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // Circle border
    ctx.beginPath(); ctx.arc(150, 150, 150, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
  };

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { imgRef.current = img; draw(); };
    img.src = src;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  useEffect(() => { draw(); });

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const s = stateRef.current;
    s.dragging = true; s.startX = e.clientX; s.startY = e.clientY; s.startOx = s.ox; s.startOy = s.oy;
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const s = stateRef.current;
      if (!s.dragging) return;
      s.ox = s.startOx + (e.clientX - s.startX);
      s.oy = s.startOy + (e.clientY - s.startY);
      draw();
    };
    const onUp = () => { stateRef.current.dragging = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleZoom = (val: number) => {
    stateRef.current.zoom = val;
    setZoom(val);
    draw();
  };

  const handleSave = () => {
    const img = imgRef.current;
    if (!img) return;
    const s = stateRef.current;
    const outSize = 200;
    const offscreen = document.createElement('canvas');
    offscreen.width = outSize; offscreen.height = outSize;
    const ctx = offscreen.getContext('2d')!;

    ctx.beginPath(); ctx.arc(100, 100, 100, 0, Math.PI * 2); ctx.clip();

    // Replicate the same transform as the preview but at 200/300 scale
    const ratio = outSize / 300;
    const scale = (Math.max(300 / img.width, 300 / img.height)) * s.zoom;
    const dw = img.width * scale * ratio;
    const dh = img.height * scale * ratio;
    const dx = (outSize - dw) / 2 + s.ox * ratio;
    const dy = (outSize - dh) / 2 + s.oy * ratio;

    ctx.drawImage(img, dx, dy, dw, dh);
    const dataUrl = offscreen.toDataURL('image/png');
    onSave(dataUrl);
  };

  return (
    <>
      <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9998 }} />
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <div style={{ width: 380, background: t.bg.surface, borderRadius: 12, padding: 24, boxShadow: t.shadow.elevated, pointerEvents: 'auto', border: `1px solid ${t.border.default}` }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: t.text.primary, marginBottom: 16 }}>Position your photo</div>
          <div style={{ width: 300, height: 300, margin: '0 auto', borderRadius: '50%', overflow: 'hidden', cursor: 'grab' }} onMouseDown={onMouseDown}>
            <canvas ref={canvasRef} width={300} height={300} style={{ display: 'block', width: 300, height: 300 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px auto 0', width: 300 }}>
            <span style={{ fontSize: 11, color: t.text.tertiary }}>−</span>
            <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(e) => handleZoom(parseFloat(e.target.value))} style={{ flex: 1, cursor: 'pointer' }} />
            <span style={{ fontSize: 11, color: t.text.tertiary }}>+</span>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button onClick={onCancel} style={{ padding: '6px 16px', fontSize: 13, border: `1px solid ${t.border.default}`, borderRadius: 6, background: t.bg.primary, color: t.text.secondary, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            <button onClick={handleSave} style={{ padding: '6px 16px', fontSize: 13, border: 'none', borderRadius: 6, background: t.accent.primary, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>Save</button>
          </div>
        </div>
      </div>
    </>
  );
}
