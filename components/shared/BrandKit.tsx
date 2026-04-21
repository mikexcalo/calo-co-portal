'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { BrandKit as BrandKitType } from '@/lib/types';
import { DB, loadClients, loadAllBrandKits, saveBrandKit } from '@/lib/database';
import { generateLogoVariants, svgToPng } from '@/lib/logo-variants';
import LogoSlot from '@/components/brand-kit/LogoSlot';
import ColorPalette from '@/components/brand-kit/ColorPalette';
import Typography from '@/components/brand-kit/Typography';
import BrandNotes from '@/components/brand-kit/BrandNotes';
import BrandKitErrorBoundary from '@/components/brand-kit/BrandKitErrorBoundary';
import { Section } from '@/components/shared/PageLayout';
import { useTheme } from '@/lib/theme';
import HelmSpinner from '@/components/shared/HelmSpinner';

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
  const [variants, setVariants] = useState<ReturnType<typeof generateLogoVariants>>([]);
  const [saved, setSaved] = useState(false);

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
          setEntityName('Manifest');
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

  if (loading) return null;
  if (error || !brandKit) return <div style={{ padding: 16, fontSize: 13, color: t.status.danger }}>{error || 'Brand Kit not found'}</div>;

  const handleLogoChange = async () => { setBrandKit({ ...brandKit }); };
  const flashSaved = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };
  const handleColorChange = (colors: string[]) => { brandKit.colors = colors; setBrandKit({ ...brandKit }); saveBrandKit(brandKit, entityId).then(flashSaved); };
  const handleFontChange = (type: 'heading' | 'body' | 'accent', value: string) => { brandKit.fonts[type] = value; setBrandKit({ ...brandKit }); saveBrandKit(brandKit, entityId).then(flashSaved); };
  const handleNotesChange = (notes: string) => { brandKit.notes = notes; setBrandKit({ ...brandKit }); saveBrandKit(brandKit, entityId).then(flashSaved); };

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

  const handleGenerateVariants = async () => {
    if (!brandKit?.logos) { console.error('No logos in brand kit'); return; }

    let svgString: string | null = null;
    for (const category of ['color', 'light', 'dark', 'icon', 'secondary'] as const) {
      const logos = brandKit.logos[category];
      if (!Array.isArray(logos)) continue;
      for (const logo of logos) {
        const data = (logo.data || '') as string;
        if (!data) continue;
        // Raw SVG string
        if (data.trim().startsWith('<svg') || data.trim().startsWith('<?xml')) { svgString = data; break; }
        // Base64 SVG data URL
        if (data.startsWith('data:image/svg+xml;base64,')) { try { svgString = atob(data.split(',')[1]); break; } catch { continue; } }
        // URL-encoded SVG data URL
        if (data.startsWith('data:image/svg+xml,')) { try { svgString = decodeURIComponent(data.split(',')[1]); break; } catch { continue; } }
        // .svg filename with base64 data (no mime prefix)
        if ((logo.name || '').toLowerCase().endsWith('.svg') && data.length > 100) {
          try { const decoded = atob(data); if (decoded.includes('<svg')) { svgString = decoded; break; } } catch { /* skip */ }
        }
        // URL to SVG file — fetch it
        if ((logo.name || '').toLowerCase().endsWith('.svg') && data.startsWith('http')) {
          try {
            const resp = await fetch(data);
            const text = await resp.text();
            if (text.includes('<svg')) { svgString = text; break; }
          } catch { continue; }
        }
      }
      if (svgString) break;
    }

    if (!svgString) { console.error('No SVG logo found in brand kit'); return; }
    console.log('Found SVG, length:', svgString.length);

    const primary = (typeof brandKit.colors?.[0] === 'string' ? brandKit.colors[0] : (brandKit.colors?.[0] as any)?.hex) || '#2563eb';
    const secondary = (typeof brandKit.colors?.[1] === 'string' ? brandKit.colors[1] : (brandKit.colors?.[1] as any)?.hex) || undefined;
    setVariants(generateLogoVariants(svgString, primary, secondary));
  };

  const hasSvgLogo = (() => {
    if (!brandKit?.logos) return false;
    for (const category of ['color', 'light', 'dark', 'icon', 'secondary'] as const) {
      const logos = brandKit.logos[category];
      if (!Array.isArray(logos)) continue;
      for (const logo of logos) {
        const data = (logo.data || '') as string;
        const name = (logo.name || '').toLowerCase();
        if (name.endsWith('.svg')) return true;
        if (data.trim().startsWith('<svg') || data.startsWith('data:image/svg+xml')) return true;
      }
    }
    return false;
  })();

  const downloadSvg = (v: typeof variants[0]) => {
    const blob = new Blob([v.svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `logo-${v.name}.svg`; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPng = async (v: typeof variants[0]) => {
    try {
      const pngUrl = await svgToPng(v.svgString, 1200);
      const a = document.createElement('a'); a.href = pngUrl; a.download = `logo-${v.name}.png`; a.click();
    } catch (e) { console.error('PNG export failed:', e); }
  };

  const card: React.CSSProperties = { background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 12, padding: 16, minHeight: 180, display: 'flex', flexDirection: 'column' };

  return (
    <BrandKitErrorBoundary clientId={entityId} clientName={entityName}>
      {saved && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: t.status.success, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="4 12 9 17 20 6"/></svg>Saved
          </span>
        </div>
      )}
      {readOnly && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: t.status.success, background: t.accent.subtle, border: `1px solid ${t.border.default}`, borderRadius: 8, padding: '8px 12px', marginBottom: 16 }}>
          Read-only view
        </div>
      )}

      {/* Logos */}
      <Section label="Logos">
        <div style={{ fontSize: 12, color: t.text.tertiary, marginBottom: 16, lineHeight: 1.5 }}>Used in invoice headers, quote PDFs, email signatures, and Design Studio templates.</div>
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

      {/* Logo Variant Generator */}
      {!readOnly && hasSvgLogo && (
        <div style={{ marginBottom: 16 }}>
          <button
            onClick={handleGenerateVariants}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: t.bg.surface, color: t.text.primary,
              border: `1px solid ${t.border.default}`, borderRadius: 8,
              padding: '8px 16px', fontSize: 13, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 150ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = t.bg.surfaceHover; e.currentTarget.style.borderColor = t.border.hover; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = t.bg.surface; e.currentTarget.style.borderColor = t.border.default; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="8" height="8" rx="1"/><rect x="14" y="2" width="8" height="8" rx="1"/><rect x="2" y="14" width="8" height="8" rx="1"/><rect x="14" y="14" width="8" height="8" rx="1"/></svg>
            Generate variants
          </button>
        </div>
      )}

      {variants.length > 0 && (
        <Section label="Logo Variants">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {variants.map(v => (
              <div key={v.name} style={{ border: `0.5px solid ${t.border.default}`, borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 100, background: v.bgColor }}>
                  <div style={{ maxWidth: 140, maxHeight: 80 }} ref={el => { if (el) { const svg = el.querySelector('svg'); if (svg) { svg.style.maxWidth = '100%'; svg.style.height = 'auto'; svg.style.display = 'block'; } } }} dangerouslySetInnerHTML={{ __html: v.svgString }} />
                </div>
                <div style={{ padding: '10px 12px', background: t.bg.surface, borderTop: `0.5px solid ${t.border.default}` }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: t.text.primary, marginBottom: 2 }}>{v.label}</div>
                  <div style={{ fontSize: 11, color: t.text.tertiary, marginBottom: 8 }}>{v.description}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => downloadSvg(v)} style={{ fontSize: 11, fontWeight: 500, padding: '4px 10px', borderRadius: 4, border: `0.5px solid ${t.border.default}`, background: t.bg.surface, color: t.text.secondary, cursor: 'pointer', fontFamily: 'inherit' }}>SVG</button>
                    <button onClick={() => downloadPng(v)} style={{ fontSize: 11, fontWeight: 500, padding: '4px 10px', borderRadius: 4, border: `0.5px solid ${t.border.default}`, background: t.bg.surface, color: t.text.secondary, cursor: 'pointer', fontFamily: 'inherit' }}>PNG</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Colors | Typography */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Section label="Colors"><div style={{ fontSize: 12, color: t.text.tertiary, marginBottom: 16, lineHeight: 1.5 }}>Used across quote PDFs, invoice accents, and design templates.</div><div style={card}><ColorPalette colors={brandKit.colors || []} readOnly={readOnly} onColorsChange={handleColorChange} /></div></Section>
        <Section label="Typography"><div style={{ fontSize: 12, color: t.text.tertiary, marginBottom: 16, lineHeight: 1.5 }}>Applied to all exported PDFs and design assets.</div><div style={card}><Typography fonts={brandKit.fonts} readOnly={readOnly} onFontChange={handleFontChange} /></div></Section>
      </div>

      {/* Business Info + Notes — full width (client context only) */}
      {context.type === 'client' && (
        <BusinessInfoCard t={t} entityId={entityId} readOnly={readOnly} brandKit={brandKit} handleNotesChange={handleNotesChange} />
      )}
    </BrandKitErrorBoundary>
  );
}



function BusinessInfoCard({ t, entityId, readOnly, brandKit, handleNotesChange }: { t: any; entityId: string; readOnly: boolean; brandKit: any; handleNotesChange: (n: string) => void }) {
  const [fields, setFields] = useState({ tagline: '', serviceArea: '', licenseNumber: '', socialInstagram: '', socialFacebook: '' });
  const [headshot, setHeadshot] = useState<{ url: string; filename: string } | null>(null);
  const [hsUploading, setHsUploading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!document.getElementById('hs-spin-kf')) {
      const style = document.createElement('style'); style.id = 'hs-spin-kf';
      style.textContent = '@keyframes hs-spin { to { transform: rotate(360deg); } }';
      document.head.appendChild(style);
    }
    (async () => {
      try {
        const bbf = await loadBbf(entityId);
        setFields({ tagline: bbf.tagline || '', serviceArea: bbf.serviceArea || '', licenseNumber: bbf.licenseNumber || '', socialInstagram: bbf.socialInstagram || '', socialFacebook: bbf.socialFacebook || '' });
        const hs = bbf?.headshots?.owner;
        if (hs) setHeadshot(hs);
      } catch {}
    })();
  }, [entityId]);

  const update = (key: string, value: string) => {
    const next = { ...fields, [key]: value };
    setFields(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try { await saveBbf(entityId, next); } catch {}
    }, 500);
  };

  const handleHsUpload = async (file: File) => {
    setHsUploading(true);
    try {
      const supabase = (await import('@/lib/supabase')).default;
      const path = `headshots/${entityId}/owner-${Date.now()}-${file.name}`;
      await supabase.storage.from('brand-assets').upload(path, file, { upsert: true });
      const { data } = supabase.storage.from('brand-assets').getPublicUrl(path);
      const hs = { url: data.publicUrl, filename: file.name };
      setHeadshot(hs);
      const bbf = await loadBbf(entityId);
      await saveBbf(entityId, { headshots: { ...bbf.headshots, owner: hs } });
    } catch (e) { console.warn('[Headshot upload]', e); }
    finally { setHsUploading(false); }
  };

  const removeHs = async () => {
    setHeadshot(null);
    try {
      const bbf = await loadBbf(entityId);
      const hs = { ...bbf.headshots }; delete hs.owner;
      await saveBbf(entityId, { headshots: hs });
    } catch {}
  };

  const downloadHs = (shape: 'square' | 'circle') => {
    if (!headshot?.url) return;
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => {
      const size = 500; const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      if (shape === 'circle') { ctx.beginPath(); ctx.arc(250, 250, 250, 0, Math.PI * 2); ctx.clip(); }
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min) / 2; const sy = (img.height - min) / 2;
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
      const link = document.createElement('a'); link.download = `headshot-${shape}.png`; link.href = canvas.toDataURL('image/png'); link.click();
    };
    img.src = headshot.url;
  };

  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', fontSize: 13, border: `1px solid ${t.border.default}`, borderRadius: t.radius.sm, background: t.bg.primary, color: t.text.primary, fontFamily: 'inherit', outline: 'none' };
  const labelStyle: React.CSSProperties = { fontSize: 11, color: t.text.secondary, display: 'block', marginBottom: 4 };
  const card: React.CSSProperties = { background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 12, padding: 16 };

  return (
    <Section label="Business Info">
      <div style={card}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
          {/* Headshot circle */}
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            {headshot?.url ? (
              <>
                <div style={{ width: 60, height: 60, borderRadius: '50%', overflow: 'hidden', border: `1px solid ${t.border.default}` }}>
                  <img src={headshot.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </div>
                {!readOnly && (
                  <span onClick={removeHs} style={{ fontSize: 11, color: t.text.tertiary, cursor: 'pointer' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = t.status.danger}
                    onMouseLeave={(e) => e.currentTarget.style.color = t.text.tertiary}>
                    Remove
                  </span>
                )}
              </>
            ) : (
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 60, height: 60, borderRadius: '50%', border: `1px dashed ${t.border.default}`, cursor: readOnly ? 'default' : 'pointer', color: t.text.tertiary, fontSize: 16 }}>
                {hsUploading ? (
                  <svg width="20" height="20" viewBox="0 0 28 28" style={{ animation: 'hs-spin 1s linear infinite' }}>
                    <circle cx="14" cy="14" r="12" fill="none" stroke={t.border.default} strokeWidth="2.5" opacity="0.3" />
                    <circle cx="14" cy="14" r="12" fill="none" stroke={t.accent.primary} strokeWidth="2.5" strokeDasharray="60 40" strokeLinecap="round" />
                  </svg>
                ) : '+'}
                {!readOnly && !hsUploading && <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { if (e.target.files?.[0]) handleHsUpload(e.target.files[0]); }} />}
              </label>
            )}
            {headshot?.url && (
              <div style={{ fontSize: 9, color: t.text.tertiary, display: 'flex', gap: 4 }}>
                <span onClick={() => downloadHs('circle')} style={{ cursor: 'pointer', textDecoration: 'underline' }}>circle</span>
                <span>·</span>
                <span onClick={() => downloadHs('square')} style={{ cursor: 'pointer', textDecoration: 'underline' }}>square</span>
              </div>
            )}
          </div>
          {/* Fields grid */}
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div><label style={labelStyle}>Tagline / Slogan</label><input value={fields.tagline} onChange={(e) => update('tagline', e.target.value)} placeholder="Your trusted partner" disabled={readOnly} style={inputStyle} /></div>
            <div><label style={labelStyle}>Service Area</label><input value={fields.serviceArea} onChange={(e) => update('serviceArea', e.target.value)} placeholder="Portland Metro" disabled={readOnly} style={inputStyle} /></div>
            <div><label style={labelStyle}>License / Cert #</label><input value={fields.licenseNumber} onChange={(e) => update('licenseNumber', e.target.value)} placeholder="LIC-12345" disabled={readOnly} style={inputStyle} /></div>
          </div>
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
