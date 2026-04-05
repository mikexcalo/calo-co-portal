'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
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
  return (
    <Suspense fallback={<div style={{ padding: 32, opacity: 0.5, fontSize: 13 }}>Loading...</div>}>
      <SettingsContent />
    </Suspense>
  );
}

// ═══════════════════════════════════════════
// Crop Editor Modal
// ═══════════════════════════════════════════
function CropModal({ src, t, onSave, onCancel }: { src: string; t: any; onSave: (dataUrl: string) => void; onCancel: () => void }) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const imgRef = useRef<HTMLImageElement>(null);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    setDragging(true);
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setOffset({ x: dragStart.current.ox + dx, y: dragStart.current.oy + dy });
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.max(1, Math.min(3, z - e.deltaY * 0.002)));
  }, []);

  const handleSave = () => {
    const img = imgRef.current;
    if (!img) return;
    const size = 200;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.beginPath(); ctx.arc(100, 100, 100, 0, Math.PI * 2); ctx.clip();

    // The viewport is 200px circle in a 320px container
    // Image is displayed at: naturalW * displayScale * zoom
    // displayScale fits image to 320px wide
    const displayScale = 320 / img.naturalWidth;
    const totalScale = displayScale * zoom;

    // Center of the 320px container = 160, circle center = 160
    // Image top-left in display coords: offset.x, offset.y (relative to container center)
    // We need to map the 200px circle (centered at 160,160 in display) back to source pixels
    const circleDisplayCx = 160;
    const circleDisplayCy = 160;
    // Source pixel at display center of circle
    const srcCx = (circleDisplayCx - offset.x) / totalScale;
    const srcCy = (circleDisplayCy - offset.y) / totalScale;
    // Source rect for the 200px output = 200/totalScale source pixels
    const srcSize = size / totalScale;

    ctx.drawImage(img, srcCx - srcSize / 2, srcCy - srcSize / 2, srcSize, srcSize, 0, 0, size, size);
    onSave(canvas.toDataURL('image/png'));
  };

  return (
    <>
      {/* Backdrop */}
      <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999 }} />
      {/* Modal */}
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 400, background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 12, padding: 24, boxShadow: t.shadow.elevated, zIndex: 1000 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: t.text.primary, marginBottom: 16 }}>Position your photo</div>

        {/* Crop viewport */}
        <div
          onMouseDown={onMouseDown}
          onWheel={onWheel}
          style={{ position: 'relative', width: 320, height: 320, margin: '0 auto', overflow: 'hidden', cursor: dragging ? 'grabbing' : 'grab', borderRadius: 8, background: '#000', userSelect: 'none' }}
        >
          <img
            ref={imgRef}
            src={src}
            alt=""
            draggable={false}
            style={{
              position: 'absolute',
              width: 320 * zoom,
              height: 'auto',
              left: 160 - (320 * zoom) / 2 + offset.x,
              top: 160 - (320 * zoom * (imgRef.current ? imgRef.current.naturalHeight / imgRef.current.naturalWidth : 1)) / 2 + offset.y,
              pointerEvents: 'none',
            }}
          />
          {/* Circle mask overlay — 4 corner darkeners */}
          <svg width="320" height="320" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <defs>
              <mask id="crop-mask">
                <rect width="320" height="320" fill="white" />
                <circle cx="160" cy="160" r="100" fill="black" />
              </mask>
            </defs>
            <rect width="320" height="320" fill="rgba(0,0,0,0.5)" mask="url(#crop-mask)" />
            <circle cx="160" cy="160" r="100" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" />
          </svg>
        </div>

        {/* Zoom slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px auto 0', width: 320 }}>
          <span style={{ fontSize: 11, color: t.text.tertiary }}>−</span>
          <input type="range" min="1" max="3" step="0.02" value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))}
            style={{ flex: 1, cursor: 'pointer' }} />
          <span style={{ fontSize: 11, color: t.text.tertiary }}>+</span>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onCancel} style={{ padding: '6px 16px', fontSize: 13, border: `1px solid ${t.border.default}`, borderRadius: 6, background: t.bg.primary, color: t.text.secondary, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={handleSave} style={{ padding: '6px 16px', fontSize: 13, border: 'none', borderRadius: 6, background: t.accent.primary, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>Save</button>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════
// Settings Content
// ═══════════════════════════════════════════
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
  const [rawPhoto, setRawPhoto] = useState<string | null>(null); // uncropped upload for editor
  const [cropOpen, setCropOpen] = useState(false);

  // ── Agency state ──
  const [ag, setAg] = useState<Record<string, string>>({});

  useEffect(() => {
    setProfile(loadJson(PROFILE_KEY, { name: 'Mike Calo', title: 'Founder', email: '' }));
    setAvatar(localStorage.getItem(AVATAR_KEY) || null);
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
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      setRawPhoto(url);
      setCropOpen(true);
    };
    reader.readAsDataURL(file);
    // Reset so same file can be re-selected
    e.target.value = '';
  };

  const handleCropSave = (dataUrl: string) => {
    localStorage.setItem(AVATAR_KEY, dataUrl);
    window.dispatchEvent(new Event('storage'));
    setAvatar(dataUrl);
    setCropOpen(false);
  };

  const handleEdit = () => {
    // Re-open crop modal with current avatar (or rawPhoto if available)
    setRawPhoto(avatar);
    setCropOpen(true);
  };

  const handleRemove = () => {
    setAvatar(null);
    setRawPhoto(null);
    localStorage.removeItem(AVATAR_KEY);
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

  const updateAg = (key: string, value: string) => {
    const next = { ...ag, [key]: value };
    setAg(next);
    localStorage.setItem(AGENCY_KEY, JSON.stringify(next));
  };

  // ── Styles ──
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

              {/* ═══ PROFILE ═══ */}
              {activeTab === 'profile' && (
                <div style={{ display: 'flex', gap: 28 }}>
                  <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    {avatar ? (
                      <div style={{ width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${t.border.default}` }}>
                        <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      </div>
                    ) : (
                      <div onClick={() => fileRef.current?.click()}
                        style={{ width: 80, height: 80, borderRadius: '50%', border: `1px dashed ${t.border.default}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: t.text.tertiary, fontSize: 20 }}>
                        +
                      </div>
                    )}
                    <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUpload} />

                    {avatar ? (
                      <>
                        <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
                          <span onClick={handleEdit} style={{ color: t.accent.text, cursor: 'pointer' }}>Edit</span>
                          <span onClick={handleRemove} style={{ color: t.text.tertiary, cursor: 'pointer' }}
                            onMouseEnter={(e) => e.currentTarget.style.color = t.status.danger}
                            onMouseLeave={(e) => e.currentTarget.style.color = t.text.tertiary}>Remove</span>
                        </div>
                        <div style={{ fontSize: 11, color: t.accent.text, display: 'flex', gap: 4 }}>
                          <span onClick={() => handleDownload(true)} style={{ cursor: 'pointer' }}>Download circle PNG</span>
                          <span style={{ color: t.text.tertiary }}>·</span>
                          <span onClick={() => handleDownload(false)} style={{ cursor: 'pointer' }}>Download square PNG</span>
                        </div>
                      </>
                    ) : (
                      <span onClick={() => fileRef.current?.click()}
                        style={{ fontSize: 11, color: t.accent.text, cursor: 'pointer' }}>
                        Upload photo
                      </span>
                    )}
                  </div>

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, justifyContent: 'center' }}>
                    <div><label style={lbl}>Name</label><input value={profile.name} onChange={(e) => updateProfile('name', e.target.value)} placeholder="Mike Calo" style={input} onFocus={fi} onBlur={fo} /></div>
                    <div><label style={lbl}>Title</label><input value={profile.title} onChange={(e) => updateProfile('title', e.target.value)} placeholder="Founder" style={input} onFocus={fi} onBlur={fo} /></div>
                    <div><label style={lbl}>Email</label><input type="email" value={profile.email} onChange={(e) => updateProfile('email', e.target.value)} placeholder="mike@calo.co" style={input} onFocus={fi} onBlur={fo} /></div>
                  </div>
                </div>
              )}

              {/* ═══ AGENCY ═══ */}
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

      {/* Crop modal */}
      {cropOpen && rawPhoto && (
        <CropModal src={rawPhoto} t={t} onSave={handleCropSave} onCancel={() => setCropOpen(false)} />
      )}
    </PageLayout>
  );
}
