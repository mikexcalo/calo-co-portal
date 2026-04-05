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

const DEFAULT_TOP_ORDER: SlotKey[] = ['color', 'light', 'dark'];
const SECONDARY_SLOTS: SlotKey[] = ['icon', 'secondary', 'favicon'];
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

  const card: React.CSSProperties = { background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 12, padding: 16 };

  return (
    <BrandKitErrorBoundary clientId={entityId} clientName={entityName}>
      {readOnly && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: t.status.success, background: t.accent.subtle, border: `1px solid ${t.border.default}`, borderRadius: 8, padding: '8px 12px', marginBottom: 16 }}>
          Read-only view
        </div>
      )}

      <Section label="Logo Suite">
        <div style={card}>
          {/* Primary row — reorderable */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
            {topOrder.map((slot, idx) => (
              <div key={slot} style={{ position: 'relative' }}>
                {!readOnly && (
                  <button
                    onClick={() => handleSwap(idx)}
                    title={swapSource === idx ? 'Click another slot to swap' : 'Reorder'}
                    style={{
                      position: 'absolute', top: 4, left: 4, zIndex: 2,
                      width: 18, height: 18, borderRadius: 4, border: 'none',
                      background: swapSource === idx ? t.accent.primary : 'transparent',
                      color: swapSource === idx ? '#fff' : t.text.tertiary,
                      cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background 150ms, color 150ms',
                    }}
                    onMouseEnter={(e) => { if (swapSource !== idx) e.currentTarget.style.color = t.text.primary; }}
                    onMouseLeave={(e) => { if (swapSource !== idx) e.currentTarget.style.color = t.text.tertiary; }}
                  >⋮⋮</button>
                )}
                <LogoSlot clientId={entityId} slotKey={slot} label={SLOT_LABELS[slot]} brandKit={brandKit} readOnly={readOnly} onFilesChange={handleLogoChange} />
              </div>
            ))}
          </div>

          {/* Secondary row — accordion */}
          <button
            onClick={() => setSecondaryOpen(!secondaryOpen)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 12, color: t.text.secondary, display: 'flex', alignItems: 'center', gap: 4,
              padding: '6px 0', transition: 'color 150ms',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = t.text.primary}
            onMouseLeave={(e) => e.currentTarget.style.color = t.text.secondary}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
              style={{ transition: 'transform 150ms', transform: secondaryOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>
              <polyline points="6 4 10 8 6 12"/>
            </svg>
            More logo variants
          </button>
          {secondaryOpen && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
              {SECONDARY_SLOTS.map((slot) => (
                <LogoSlot key={slot} clientId={entityId} slotKey={slot} label={SLOT_LABELS[slot]} brandKit={brandKit} readOnly={readOnly} onFilesChange={handleLogoChange} />
              ))}
            </div>
          )}

          <div style={{ marginTop: 10, fontSize: 11, color: t.text.tertiary, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: t.status.success, flexShrink: 0 }} />
            Full Color PNG/SVG is used in invoice headers and PDF exports.
          </div>

          {/* File type usage guide */}
          <FileTypeGuide t={t} />
        </div>
      </Section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <Section label="Colors"><div style={card}><ColorPalette colors={brandKit.colors || []} readOnly={readOnly} onColorsChange={handleColorChange} /></div></Section>
        <Section label="Typography"><div style={card}><Typography fonts={brandKit.fonts} readOnly={readOnly} onFontChange={handleFontChange} /></div></Section>
        <Section label="Notes"><div style={card}><BrandNotes notes={brandKit.notes || ''} readOnly={readOnly} onNotesChange={handleNotesChange} /></div></Section>
      </div>

      <BrandDetails t={t} entityId={entityId} readOnly={readOnly} />
    </BrandKitErrorBoundary>
  );
}

function FileTypeGuide({ t }: { t: any }) {
  const [open, setOpen] = useState(false);
  const items: [string, string][] = [
    ['SVG', 'Websites, apps, responsive design. Scales infinitely, smallest file size.'],
    ['PNG', 'Social media, presentations, email. Transparent background, universal support.'],
    ['PDF', 'Print vendors, brand guidelines docs. Vector quality, widely accepted.'],
    ['AI / EPS', 'Professional print, signage, large format. Editable vector source files.'],
    ['JPG', 'Quick sharing, internal docs. Smallest size but no transparency.'],
  ];
  return (
    <div style={{ marginTop: 10 }}>
      <button onClick={() => setOpen(!open)} style={{
        background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        fontSize: 11, color: t.text.tertiary, display: 'flex', alignItems: 'center', gap: 4, padding: 0,
        transition: 'color 150ms',
      }}
      onMouseEnter={(e) => e.currentTarget.style.color = t.text.secondary}
      onMouseLeave={(e) => e.currentTarget.style.color = t.text.tertiary}
      >
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
          style={{ transition: 'transform 150ms', transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}>
          <polyline points="6 4 10 8 6 12"/>
        </svg>
        Which file for what?
      </button>
      {open && (
        <div style={{ marginTop: 6, background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: t.radius.md, padding: 12 }}>
          {items.map(([type, desc]) => (
            <div key={type} style={{ fontSize: 12, color: t.text.secondary, lineHeight: 1.6 }}>
              <span style={{ fontWeight: 600, color: t.text.primary }}>{type}</span> — {desc}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BrandDetails({ t, entityId, readOnly }: { t: any; entityId: string; readOnly: boolean }) {
  const [fields, setFields] = useState({ tagline: '', serviceArea: '', licenseNumber: '', socialInstagram: '', socialFacebook: '' });
  const [headshots, setHeadshots] = useState<{ owner?: { url: string; filename: string }; team?: { url: string; filename: string } }>({});
  const [loaded, setLoaded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const cl = DB.clients.find((c) => c.id === entityId);
    if (cl) {
      const bbf = (cl as any).brand_builder_fields || {};
      setFields({
        tagline: bbf.tagline || '', serviceArea: bbf.serviceArea || '',
        licenseNumber: bbf.licenseNumber || '', socialInstagram: bbf.socialInstagram || '', socialFacebook: bbf.socialFacebook || '',
      });
      setHeadshots(bbf.headshots || {});
    }
    setLoaded(true);
  }, [entityId]);

  const saveFields = useCallback((next: any) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const supabase = (await import('@/lib/supabase')).default;
        const cl = DB.clients.find((c) => c.id === entityId);
        const existing = (cl as any)?.brand_builder_fields || {};
        await supabase.from('clients').update({ brand_builder_fields: { ...existing, ...next } }).eq('id', entityId);
      } catch (e) { console.warn('[BrandDetails] save failed:', e); }
    }, 500);
  }, [entityId]);

  const updateField = (key: string, value: string) => {
    const next = { ...fields, [key]: value };
    setFields(next);
    saveFields(next);
  };

  const handleUpload = async (slot: 'owner' | 'team', file: File) => {
    try {
      const supabase = (await import('@/lib/supabase')).default;
      const prefix = entityId === 'agency' ? 'headshots/agency' : `headshots/${entityId}`;
      const path = `${prefix}/${slot}-${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from('brand-assets').upload(path, file, { upsert: true });
      if (error) { console.warn('[Headshot upload]', error); return; }
      const { data: urlData } = supabase.storage.from('brand-assets').getPublicUrl(path);
      const updated = { ...headshots, [slot]: { url: urlData.publicUrl, filename: file.name } };
      setHeadshots(updated);
      saveFields({ ...fields, headshots: updated });
    } catch (e) { console.warn('[Headshot upload error]', e); }
  };

  const removeHeadshot = (slot: 'owner' | 'team') => {
    const updated = { ...headshots };
    delete updated[slot];
    setHeadshots(updated);
    saveFields({ ...fields, headshots: updated });
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', fontSize: 13,
    border: `1px solid ${t.border.default}`, borderRadius: t.radius.sm,
    background: t.bg.primary, color: t.text.primary, fontFamily: 'inherit', outline: 'none',
  };
  const labelStyle: React.CSSProperties = { fontSize: 11, color: t.text.secondary, display: 'block', marginBottom: 4 };
  const card: React.CSSProperties = { background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 12, padding: 16 };

  if (!loaded) return null;

  return (
    <Section label="Brand Details">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Photos */}
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 500, color: t.text.primary, marginBottom: 10 }}>Photos</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {(['owner', 'team'] as const).map((slot) => {
              const data = headshots[slot];
              return (
                <div key={slot}>
                  <label style={labelStyle}>{slot === 'owner' ? 'Owner / Primary' : 'Team Photo'}</label>
                  {data?.url ? (
                    <div style={{ position: 'relative', borderRadius: t.radius.sm, overflow: 'hidden', border: `1px solid ${t.border.default}` }}>
                      <img src={data.url} alt={data.filename} style={{ width: '100%', height: 80, objectFit: 'cover', display: 'block' }} />
                      {!readOnly && (
                        <button onClick={() => removeHeadshot(slot)} style={{
                          position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: '50%',
                          background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', fontSize: 10,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>×</button>
                      )}
                    </div>
                  ) : (
                    <label style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', height: 80,
                      border: `1px dashed ${t.border.default}`, borderRadius: t.radius.sm,
                      cursor: readOnly ? 'default' : 'pointer', color: t.text.tertiary, fontSize: 12,
                    }}>
                      {readOnly ? 'No photo' : '+ Upload'}
                      {!readOnly && <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { if (e.target.files?.[0]) handleUpload(slot, e.target.files[0]); }} />}
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Business Info */}
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 500, color: t.text.primary, marginBottom: 10 }}>Business Info</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div><label style={labelStyle}>Tagline / Slogan</label><input value={fields.tagline} onChange={(e) => updateField('tagline', e.target.value)} placeholder="Your trusted partner" disabled={readOnly} style={inputStyle} /></div>
            <div><label style={labelStyle}>Service Area</label><input value={fields.serviceArea} onChange={(e) => updateField('serviceArea', e.target.value)} placeholder="Portland Metro, South Portland" disabled={readOnly} style={inputStyle} /></div>
            <div><label style={labelStyle}>License / Certification #</label><input value={fields.licenseNumber} onChange={(e) => updateField('licenseNumber', e.target.value)} placeholder="e.g. LIC-12345" disabled={readOnly} style={inputStyle} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div><label style={labelStyle}>Instagram</label><input value={fields.socialInstagram} onChange={(e) => updateField('socialInstagram', e.target.value)} placeholder="@handle" disabled={readOnly} style={inputStyle} /></div>
              <div><label style={labelStyle}>Facebook</label><input value={fields.socialFacebook} onChange={(e) => updateField('socialFacebook', e.target.value)} placeholder="facebook.com/yourpage" disabled={readOnly} style={inputStyle} /></div>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
