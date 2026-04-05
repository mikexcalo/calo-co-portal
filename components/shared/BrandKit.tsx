'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { BrandKit as BrandKitType } from '@/lib/types';
import { DB, loadClients, loadAllBrandKits, saveBrandKit } from '@/lib/database';
import LogoSlot from '@/components/brand-kit/LogoSlot';
import ColorPalette from '@/components/brand-kit/ColorPalette';
import Typography from '@/components/brand-kit/Typography';
import BrandNotes from '@/components/brand-kit/BrandNotes';
import BrandKitErrorBoundary from '@/components/brand-kit/BrandKitErrorBoundary';
import { Section } from '@/components/shared/PageLayout';
import { useTheme } from '@/lib/theme';

const AGENCY_BRAND_ID = 'agency';
const AGENCY_LS_KEY = 'calo-agency-brand-details';

function loadAgencyData(): any { try { return JSON.parse(localStorage.getItem(AGENCY_LS_KEY) || '{}'); } catch { return {}; } }
function saveAgencyData(patch: any) { const cur = loadAgencyData(); localStorage.setItem(AGENCY_LS_KEY, JSON.stringify({ ...cur, ...patch })); }

async function loadBbf(entityId: string): Promise<any> {
  if (entityId === AGENCY_BRAND_ID) return loadAgencyData();
  const supabase = (await import('@/lib/supabase')).default;
  const { data } = await supabase.from('clients').select('brand_builder_fields').eq('id', entityId).single();
  return data?.brand_builder_fields || {};
}

async function saveBbf(entityId: string, patch: any) {
  if (entityId === AGENCY_BRAND_ID) { saveAgencyData(patch); return; }
  const supabase = (await import('@/lib/supabase')).default;
  const { data } = await supabase.from('clients').select('brand_builder_fields').eq('id', entityId).single();
  const existing = data?.brand_builder_fields || {};
  await supabase.from('clients').update({ brand_builder_fields: { ...existing, ...patch } }).eq('id', entityId);
}

const DEFAULT_TOP_ORDER: SlotKey[] = ['color', 'light', 'dark', 'icon'];
const SECONDARY_SLOTS: SlotKey[] = ['secondary', 'favicon'];
type SlotKey = 'color' | 'light' | 'dark' | 'icon' | 'secondary' | 'favicon';

const SLOT_LABELS: Record<SlotKey, string> = {
  color: 'Full Color', light: 'Light', dark: 'Dark',
  icon: 'Icon', secondary: 'Secondary', favicon: 'Favicon',
};

interface BrandKitProps {
  context: { type: 'client'; clientId: string } | { type: 'agency' };
  readOnly?: boolean;
}

function initBk(raw: BrandKitType | undefined | null): BrandKitType {
  const bk: BrandKitType = raw || {
    _id: null,
    logos: { light: [], dark: [], color: [], icon: [], secondary: [], favicon: [] },
    colors: [], fonts: { heading: '', body: '', accent: '' }, notes: '',
  };
  if (!bk.logos) bk.logos = { light: [], dark: [], color: [], icon: [], secondary: [], favicon: [] };
  (['light', 'dark', 'color', 'icon', 'secondary', 'favicon'] as const).forEach((s) => { if (!bk.logos[s]) bk.logos[s] = []; });
  if (!bk.colors) bk.colors = [];
  else if (!Array.isArray(bk.colors)) {
    try { bk.colors = typeof bk.colors === 'string' ? JSON.parse(bk.colors) : []; } catch { bk.colors = []; }
  }
  bk.colors = bk.colors.map((c: any) => typeof c === 'string' ? c : c?.hex || '#000000');
  if (!bk.fonts) bk.fonts = { heading: '', body: '', accent: '' };
  if (!bk.notes) bk.notes = '';
  return bk;
}

export default function BrandKit({ context, readOnly = false }: BrandKitProps) {
  const { t } = useTheme();
  const entityId = context.type === 'client' ? context.clientId : AGENCY_BRAND_ID;
  const [brandKit, setBrandKit] = useState<BrandKitType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entityName, setEntityName] = useState('');
  const [secondaryOpen, setSecondaryOpen] = useState(false);
  const [topOrder, setTopOrder] = useState<SlotKey[]>(DEFAULT_TOP_ORDER);
  const [swapSource, setSwapSource] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        if (DB.clientsState !== 'loaded') await loadClients();
        if (!DB.clients.some((c) => c.brandKit?._id)) await loadAllBrandKits();

        if (context.type === 'client') {
          const cl = DB.clients.find((c) => c.id === context.clientId);
          if (!cl) { setError('Client not found'); setLoading(false); return; }
          setEntityName(cl.company || cl.name || 'Client');
          setBrandKit(initBk(cl.brandKit));
        } else {
          setEntityName('CALO&CO');
          setBrandKit(initBk(null));
        }
        setLoading(false);
      } catch (err) {
        console.error('Error loading brand kit:', err);
        setError('Failed to load brand kit');
        setLoading(false);
      }
    };
    load();
  }, [context, entityId]);

  if (loading) return <div style={{ padding: 16, opacity: 0.5, fontSize: 13, color: t.text.tertiary }}>Loading Brand Kit...</div>;
  if (error || !brandKit) return <div style={{ padding: 16, fontSize: 13, color: t.status.danger }}>{error || 'Brand Kit not found'}</div>;

  const handleLogoChange = async () => { setBrandKit({ ...brandKit }); };
  const handleColorChange = (colors: string[]) => { brandKit.colors = colors; setBrandKit({ ...brandKit }); saveBrandKit(brandKit, entityId); };
  const handleFontChange = (type: 'heading' | 'body' | 'accent', value: string) => { brandKit.fonts[type] = value; setBrandKit({ ...brandKit }); saveBrandKit(brandKit, entityId); };
  const handleNotesChange = (notes: string) => { brandKit.notes = notes; setBrandKit({ ...brandKit }); saveBrandKit(brandKit, entityId); };

  const handleSwap = (idx: number) => {
    if (swapSource === null) {
      setSwapSource(idx);
    } else {
      const newOrder = [...topOrder];
      [newOrder[swapSource], newOrder[idx]] = [newOrder[idx], newOrder[swapSource]];
      setTopOrder(newOrder);
      setSwapSource(null);
    }
  };

  const card: React.CSSProperties = { background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 12, padding: 16, minHeight: 180, display: 'flex', flexDirection: 'column' };

  return (
    <BrandKitErrorBoundary clientId={entityId} clientName={entityName}>
      {readOnly && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: t.status.success, background: t.accent.subtle, border: `1px solid ${t.border.default}`, borderRadius: 8, padding: '8px 12px', marginBottom: 16 }}>
          Read-only view
        </div>
      )}

      {/* Logo Suite — top */}
      <Section label="Logo Suite">
        <div style={card}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
            {topOrder.map((slot, idx) => (
              <div key={slot} style={{ position: 'relative' }}>
                {!readOnly && (
                  <button onClick={() => handleSwap(idx)} title={swapSource === idx ? 'Click another to swap' : 'Reorder'}
                    style={{ position: 'absolute', top: 4, left: 4, zIndex: 2, width: 18, height: 18, borderRadius: 4, border: 'none',
                      background: swapSource === idx ? t.accent.primary : 'transparent', color: swapSource === idx ? '#fff' : t.text.tertiary,
                      cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 150ms, color 150ms',
                    }}
                    onMouseEnter={(e) => { if (swapSource !== idx) e.currentTarget.style.color = t.text.primary; }}
                    onMouseLeave={(e) => { if (swapSource !== idx) e.currentTarget.style.color = t.text.tertiary; }}
                  >⋮⋮</button>
                )}
                <LogoSlot clientId={entityId} slotKey={slot} label={SLOT_LABELS[slot]} brandKit={brandKit} readOnly={readOnly} onFilesChange={handleLogoChange} />
              </div>
            ))}
          </div>
          <button onClick={() => setSecondaryOpen(!secondaryOpen)} style={{
            background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 12, color: t.text.secondary, display: 'flex', alignItems: 'center', gap: 4, padding: '4px 0', transition: 'color 150ms',
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = t.text.primary}
          onMouseLeave={(e) => e.currentTarget.style.color = t.text.secondary}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ transition: 'transform 150ms', transform: secondaryOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}><polyline points="6 4 10 8 6 12"/></svg>
            More variants
          </button>
          {secondaryOpen && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
              {SECONDARY_SLOTS.map((slot) => (
                <LogoSlot key={slot} clientId={entityId} slotKey={slot} label={SLOT_LABELS[slot]} brandKit={brandKit} readOnly={readOnly} onFilesChange={handleLogoChange} />
              ))}
            </div>
          )}
          <div style={{ marginTop: 8, fontSize: 11, color: t.text.tertiary, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: t.status.success, flexShrink: 0 }} />
            Full Color PNG/SVG is used in invoice headers and PDF exports.
          </div>
        </div>
      </Section>

      {/* Colors | Typography | Headshot */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <Section label="Colors"><div style={card}><ColorPalette colors={brandKit.colors || []} readOnly={readOnly} onColorsChange={handleColorChange} /></div></Section>
        <Section label="Typography"><div style={card}><Typography fonts={brandKit.fonts} readOnly={readOnly} onFontChange={handleFontChange} /></div></Section>
        <HeadshotTile t={t} entityId={entityId} readOnly={readOnly} />
      </div>

      {/* Business Info + Notes — full width */}
      <BusinessInfoCard t={t} entityId={entityId} readOnly={readOnly} brandKit={brandKit} handleNotesChange={handleNotesChange} />
    </BrandKitErrorBoundary>
  );
}


function HeadshotTile({ t, entityId, readOnly }: { t: any; entityId: string; readOnly: boolean }) {
  const [headshot, setHeadshot] = useState<{ url: string; filename: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState<'success' | 'error' | null>(null);
  const [avatarSaved, setAvatarSaved] = useState(false);
  const [editing, setEditing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Inject spinner keyframes once
    if (!document.getElementById('hs-spin-kf')) {
      const style = document.createElement('style'); style.id = 'hs-spin-kf';
      style.textContent = '@keyframes hs-spin { to { transform: rotate(360deg); } }';
      document.head.appendChild(style);
    }
    (async () => {
      try {
        const bbf = await loadBbf(entityId);
        const hs = bbf?.headshots?.owner;
        if (hs) {
          setHeadshot(hs);
          if (hs.adjustments) { setZoom(hs.adjustments.zoom || 1); setOffset({ x: hs.adjustments.offsetX || 0, y: hs.adjustments.offsetY || 0 }); }
        }
      } catch {}
    })();
  }, [entityId]);

  const saveAdjustments = useCallback((z: number, ox: number, oy: number) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const bbf = await loadBbf(entityId);
        const owner = { ...bbf.headshots?.owner, adjustments: { zoom: z, offsetX: ox, offsetY: oy } };
        await saveBbf(entityId, { headshots: { ...bbf.headshots, owner } });
      } catch {}
    }, 500);
  }, [entityId]);

  const handleUpload = async (file: File) => {
    setUploading(true); setFeedback(null);
    try {
      const supabase = (await import('@/lib/supabase')).default;
      const path = `headshots/${entityId}/owner-${Date.now()}-${file.name}`;
      await supabase.storage.from('brand-assets').upload(path, file, { upsert: true });
      const { data } = supabase.storage.from('brand-assets').getPublicUrl(path);
      const hs = { url: data.publicUrl, filename: file.name };
      setHeadshot(hs); setZoom(1); setOffset({ x: 0, y: 0 });
      const bbf = await loadBbf(entityId);
      await saveBbf(entityId, { headshots: { ...bbf.headshots, owner: hs } });
      setFeedback('success'); setTimeout(() => setFeedback(null), 1500);
    } catch (e) { console.warn('[Headshot upload]', e); setFeedback('error'); setTimeout(() => setFeedback(null), 2000); }
    finally { setUploading(false); }
  };

  const remove = async () => {
    setHeadshot(null); setZoom(1); setOffset({ x: 0, y: 0 });
    try {
      const bbf = await loadBbf(entityId);
      const hs = { ...bbf.headshots }; delete hs.owner;
      await saveBbf(entityId, { headshots: hs });
    } catch {}
  };

  const onDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const pt = 'touches' in e ? e.touches[0] : e;
    dragStart.current = { x: pt.clientX, y: pt.clientY, ox: offset.x, oy: offset.y };
    setDragging(true);
  };
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent | TouchEvent) => {
      const pt = 'touches' in e ? e.touches[0] : e;
      const maxOff = 40 * zoom;
      const nx = Math.max(-maxOff, Math.min(maxOff, dragStart.current.ox + pt.clientX - dragStart.current.x));
      const ny = Math.max(-maxOff, Math.min(maxOff, dragStart.current.oy + pt.clientY - dragStart.current.y));
      setOffset({ x: nx, y: ny });
    };
    const onUp = () => { setDragging(false); saveAdjustments(zoom, offset.x, offset.y); };
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove); window.addEventListener('touchend', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); window.removeEventListener('touchmove', onMove); window.removeEventListener('touchend', onUp); };
  }, [dragging, zoom, offset, saveAdjustments]);

  const renderCropped = (size: number, circle: boolean): string | null => {
    if (!headshot?.url) return null;
    const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d'); if (!ctx) return null;
    if (circle) { ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); ctx.clip(); }
    const img = new Image(); img.crossOrigin = 'anonymous'; img.src = headshot.url;
    // Sync draw — only works if image is cached
    const s = size * zoom; const dx = (size - s) / 2 + offset.x * (size / 120); const dy = (size - s) / 2 + offset.y * (size / 120);
    ctx.drawImage(img, dx, dy, s, s);
    return canvas.toDataURL('image/png');
  };

  const downloadCropped = (shape: 'square' | 'circle') => {
    if (!headshot?.url) return;
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => {
      const size = 500; const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      if (shape === 'circle') { ctx.beginPath(); ctx.arc(250, 250, 250, 0, Math.PI * 2); ctx.clip(); }
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min) / 2 - (offset.x / 120) * min / zoom;
      const sy = (img.height - min) / 2 - (offset.y / 120) * min / zoom;
      const sw = min / zoom;
      ctx.drawImage(img, sx, sy, sw, sw, 0, 0, size, size);
      const link = document.createElement('a'); link.download = `headshot-${shape}.png`; link.href = canvas.toDataURL('image/png'); link.click();
    };
    img.src = headshot.url;
  };

  const useAsAvatar = async () => {
    if (!headshot?.url) return;
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = async () => {
      const size = 200; const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      ctx.beginPath(); ctx.arc(100, 100, 100, 0, Math.PI * 2); ctx.clip();
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min) / 2 - (offset.x / 120) * min / zoom;
      const sy = (img.height - min) / 2 - (offset.y / 120) * min / zoom;
      ctx.drawImage(img, sx, sy, min / zoom, min / zoom, 0, 0, size, size);
      const avatarUrl = canvas.toDataURL('image/png');
      try {
        await saveBbf(entityId, { avatarUrl });
        if (entityId === AGENCY_BRAND_ID) localStorage.setItem('calo-agency-avatar', avatarUrl);
        setAvatarSaved(true); setTimeout(() => setAvatarSaved(false), 1500);
      } catch { setFeedback('error'); setTimeout(() => setFeedback(null), 2000); }
    };
    img.src = headshot.url;
  };

  const borderColor = feedback === 'success' ? t.status.success : feedback === 'error' ? t.status.danger : t.border.default;
  const btnStyle: React.CSSProperties = { fontSize: 10, padding: '3px 8px', border: `1px solid ${t.border.default}`, borderRadius: t.radius.sm, background: t.bg.primary, color: t.text.secondary, cursor: 'pointer', fontFamily: 'inherit' };

  return (
    <Section label="Headshot">
      <div style={{ background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 12, padding: 16, minHeight: 180, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        {headshot?.url ? (
          <>
            {/* Edit/Done toggle */}
            {!readOnly && (
              <button onClick={() => { if (editing) { saveAdjustments(zoom, offset.x, offset.y); setEditing(false); } else { setEditing(true); } }}
                style={{ position: 'absolute', top: 10, right: 12, background: 'none', border: 'none', fontSize: 11, color: t.text.secondary, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
                onMouseEnter={(e) => e.currentTarget.style.color = t.text.primary}
                onMouseLeave={(e) => e.currentTarget.style.color = t.text.secondary}>
                {editing ? 'Done' : 'Edit'}
              </button>
            )}
            {/* Circle viewport */}
            <div style={{ position: 'relative', width: 120, height: 120, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${borderColor}`, margin: '0 auto', cursor: editing ? (dragging ? 'grabbing' : 'grab') : 'default', transition: 'border-color 300ms' }}
              onMouseDown={editing ? onDragStart : undefined} onTouchStart={editing ? onDragStart : undefined}>
              <img src={headshot.url} alt="" draggable={false} style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`, pointerEvents: 'none' }} />
              {!readOnly && <button onClick={(e) => { e.stopPropagation(); remove(); setEditing(false); }} style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>×</button>}
            </div>
            {/* Zoom slider — only in edit mode */}
            {editing && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, width: 120 }}>
                <span style={{ fontSize: 12 }}>🔍</span>
                <input type="range" min="1" max="3" step="0.05" value={zoom}
                  onChange={(e) => { const z = parseFloat(e.target.value); setZoom(z); saveAdjustments(z, offset.x, offset.y); }}
                  style={{ flex: 1, height: 4, cursor: 'pointer' }} />
              </div>
            )}
            {/* Action buttons — single row */}
            <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 6, flexWrap: 'nowrap' }}>
              <button onClick={() => downloadCropped('square')} style={btnStyle}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 2, verticalAlign: '-1px' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Square
              </button>
              <button onClick={() => downloadCropped('circle')} style={btnStyle}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 2, verticalAlign: '-1px' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Circle
              </button>
              {!readOnly && (
                <button onClick={useAsAvatar} style={{ ...btnStyle, color: avatarSaved ? t.status.success : t.accent.text }}>
                  {avatarSaved ? (
                    <><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ marginRight: 2, verticalAlign: '-1px' }}><polyline points="20 6 9 17 4 12"/></svg>Saved</>
                  ) : (
                    <><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 2, verticalAlign: '-1px' }}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>Profile pic</>
                  )}
                </button>
              )}
            </div>
          </>
        ) : (
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 120, height: 120, borderRadius: '50%', border: `1px dashed ${feedback === 'error' ? t.status.danger : t.border.default}`, cursor: readOnly ? 'default' : 'pointer', color: feedback === 'error' ? t.status.danger : t.text.tertiary, fontSize: 18, margin: '0 auto', transition: 'border-color 300ms', position: 'relative' }}>
            {uploading ? (
              <svg width="28" height="28" viewBox="0 0 28 28" style={{ animation: 'hs-spin 1s linear infinite' }}>
                <circle cx="14" cy="14" r="12" fill="none" stroke={t.border.default} strokeWidth="2.5" opacity="0.3" />
                <circle cx="14" cy="14" r="12" fill="none" stroke={t.accent.primary} strokeWidth="2.5" strokeDasharray="60 40" strokeLinecap="round" />
              </svg>
            ) : feedback === 'error' ? 'Failed' : '+'}
            {!readOnly && !uploading && <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); }} />}
          </label>
        )}
      </div>
    </Section>
  );
}

function BusinessInfoCard({ t, entityId, readOnly, brandKit, handleNotesChange }: { t: any; entityId: string; readOnly: boolean; brandKit: any; handleNotesChange: (n: string) => void }) {
  const [fields, setFields] = useState({ tagline: '', serviceArea: '', licenseNumber: '', socialInstagram: '', socialFacebook: '' });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const bbf = await loadBbf(entityId);
        setFields({ tagline: bbf.tagline || '', serviceArea: bbf.serviceArea || '', licenseNumber: bbf.licenseNumber || '', socialInstagram: bbf.socialInstagram || '', socialFacebook: bbf.socialFacebook || '' });
      } catch {}
    })();
  }, [entityId]);

  const update = (key: string, value: string) => {
    const next = { ...fields, [key]: value };
    setFields(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        await saveBbf(entityId, next);
      } catch {}
    }, 500);
  };

  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', fontSize: 13, border: `1px solid ${t.border.default}`, borderRadius: t.radius.sm, background: t.bg.primary, color: t.text.primary, fontFamily: 'inherit', outline: 'none' };
  const labelStyle: React.CSSProperties = { fontSize: 11, color: t.text.secondary, display: 'block', marginBottom: 4 };
  const card: React.CSSProperties = { background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 12, padding: 16 };

  return (
    <Section label="Business Info">
      <div style={card}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div><label style={labelStyle}>Tagline / Slogan</label><input value={fields.tagline} onChange={(e) => update('tagline', e.target.value)} placeholder="Your trusted partner" disabled={readOnly} style={inputStyle} /></div>
          <div><label style={labelStyle}>Service Area</label><input value={fields.serviceArea} onChange={(e) => update('serviceArea', e.target.value)} placeholder="Portland Metro" disabled={readOnly} style={inputStyle} /></div>
          <div><label style={labelStyle}>License / Cert #</label><input value={fields.licenseNumber} onChange={(e) => update('licenseNumber', e.target.value)} placeholder="LIC-12345" disabled={readOnly} style={inputStyle} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div><label style={labelStyle}>Instagram</label><input value={fields.socialInstagram} onChange={(e) => update('socialInstagram', e.target.value)} placeholder="@handle" disabled={readOnly} style={inputStyle} /></div>
          <div><label style={labelStyle}>Facebook</label><input value={fields.socialFacebook} onChange={(e) => update('socialFacebook', e.target.value)} placeholder="facebook.com/page" disabled={readOnly} style={inputStyle} /></div>
          <div />
        </div>
        <div>
          <label style={labelStyle}>Notes</label>
          <BrandNotes notes={brandKit.notes || ''} readOnly={readOnly} onNotesChange={handleNotesChange} />
        </div>
      </div>
    </Section>
  );
}
